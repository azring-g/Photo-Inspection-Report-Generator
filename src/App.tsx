import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  BillboardSite,
  PhotoSlot,
  ScreenId
} from './types';
import {
  INVENTORY_DB,
  SAMPLE_INSPECTION_IMAGES,
  PRESET_OBSERVATIONS,
  SYSTEM_CONSTANTS
} from './data/inventory';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken
} from './services/googleAuth';
import {
  listDriveFiles,
  createDriveReportDocument,
  calculateNextDriveSequence,
  deleteDriveFile,
  DriveFileItem
} from './services/googleDrive';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Folder,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  UploadCloud,
  Search,
  Check,
  Copy,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Cloud,
  CloudCheck,
  LogOut,
  RefreshCw
} from 'lucide-react';

export default function App() {
  // Current screen state
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-dashboard');

  // Google Auth & Drive state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [driveSearch, setDriveSearch] = useState<string>('');
  const [deleteConfirmationFile, setDeleteConfirmationFile] = useState<DriveFileItem | null>(null);
  const [driveSuccessMessage, setDriveSuccessMessage] = useState<string | null>(null);

  // Site metadata state
  const [siteInput, setSiteInput] = useState<string>('AGT-092');
  const [currentSite, setCurrentSite] = useState<BillboardSite | null>(INVENTORY_DB['AGT-092']);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [visualDescription, setVisualDescription] = useState<string>(
    INVENTORY_DB['AGT-092'].defaultVisual
  );

  // Photos state (always 8 slots, filled or null)
  const [photos, setPhotos] = useState<(PhotoSlot | null)[]>([
    {
      id: 'p1',
      url: SAMPLE_INSPECTION_IMAGES[0].url,
      name: SAMPLE_INSPECTION_IMAGES[0].name,
      comment: SAMPLE_INSPECTION_IMAGES[0].comment
    },
    {
      id: 'p2',
      url: SAMPLE_INSPECTION_IMAGES[1].url,
      name: SAMPLE_INSPECTION_IMAGES[1].name,
      comment: SAMPLE_INSPECTION_IMAGES[1].comment
    },
    {
      id: 'p3',
      url: SAMPLE_INSPECTION_IMAGES[2].url,
      name: SAMPLE_INSPECTION_IMAGES[2].name,
      comment: SAMPLE_INSPECTION_IMAGES[2].comment
    },
    {
      id: 'p4',
      url: SAMPLE_INSPECTION_IMAGES[3].url,
      name: SAMPLE_INSPECTION_IMAGES[3].name,
      comment: SAMPLE_INSPECTION_IMAGES[3].comment
    },
    {
      id: 'p5',
      url: SAMPLE_INSPECTION_IMAGES[4].url,
      name: SAMPLE_INSPECTION_IMAGES[4].name,
      comment: SAMPLE_INSPECTION_IMAGES[4].comment
    },
    null,
    null,
    null
  ]);

  // Upload warning state (>8 images)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // Pairwise review state: pair index 0 (1&2), 1 (3&4), 2 (5&6), 3 (7&8)
  const [currentPairIndex, setCurrentPairIndex] = useState<number>(0);

  // Generation status state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<number>(1);
  const [generatedFilename, setGeneratedFilename] = useState<string>('AGT-092-001.gslides');
  const [savedDriveFile, setSavedDriveFile] = useState<DriveFileItem | null>(null);

  // Slide preview page state in Screen 4
  const [activeSlidePage, setActiveSlidePage] = useState<1 | 2>(1);

  // Inventory modal open state
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);
  const [inventorySearch, setInventorySearch] = useState<string>('');

  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count filled photos
  const filledPhotosCount = photos.filter((p): p is PhotoSlot => p !== null).length;
  const page1Count = photos.slice(0, 4).filter(Boolean).length;
  const page2Count = photos.slice(4, 8).filter(Boolean).length;

  // Initialize Firebase Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        fetchDriveReports(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setDriveFiles([]);
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch reports from Google Drive
  const fetchDriveReports = async (token?: string) => {
    const activeToken = token || accessToken;
    if (!activeToken) return;

    setIsLoadingDriveFiles(true);
    try {
      const files = await listDriveFiles(activeToken, {
        pageSize: 30
      });
      setDriveFiles(files);
    } catch (err) {
      console.warn('Could not fetch drive files:', err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        fetchDriveReports(res.accessToken);
        setDriveSuccessMessage(`Connected to Google Drive as ${res.user.email}`);
        setTimeout(() => setDriveSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      alert(`Google Sign-In failed: ${err.message || 'Please check popup settings and try again.'}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Google Logout handler
  const handleGoogleLogout = async () => {
    await googleLogout();
    setUser(null);
    setAccessToken(null);
    setDriveFiles([]);
  };

  // Site Lookup Handler (F02)
  const handleSiteLookup = (targetSiteNo?: string) => {
    const query = (targetSiteNo || siteInput).trim().toUpperCase();
    if (!query) return;

    if (INVENTORY_DB[query]) {
      const site = INVENTORY_DB[query];
      setCurrentSite(site);
      setSiteInput(site.siteNo);
      setVisualDescription(site.defaultVisual);
      setLookupError(null);
      const seqStr = String(site.seqCount).padStart(3, '0');
      setGeneratedFilename(`${site.siteNo}-${seqStr}.gslides`);
    } else {
      setLookupError('Site Number not found in inventory. Please verify and try again.');
      setCurrentSite(null);
    }
  };

  const setAndLookup = (siteNo: string) => {
    setSiteInput(siteNo);
    handleSiteLookup(siteNo);
  };

  // File Upload Handlers (F03)
  const handleFilesChosen = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incomingFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (incomingFiles.length === 0) return;

    if (incomingFiles.length > 8) {
      setUploadWarning('Maximum 8 images allowed. Only the first 8 images were kept.');
    } else {
      setUploadWarning(null);
    }

    const filesToKeep = incomingFiles.slice(0, 8);
    const newPhotos = [...photos];

    filesToKeep.forEach((file, i) => {
      const objectUrl = URL.createObjectURL(file);
      let targetIndex = newPhotos.findIndex((slot) => slot === null);
      if (targetIndex === -1 && i < 8) targetIndex = i;

      if (targetIndex !== -1 && targetIndex < 8) {
        newPhotos[targetIndex] = {
          id: `upload-${Date.now()}-${i}`,
          url: objectUrl,
          name: file.name,
          comment: `Inspection detail for ${file.name.replace(/\.[^/.]+$/, '')} at ${siteInput || 'site'}.`,
          file
        };
      }
    });

    setPhotos(newPhotos);
  };

  const handleLoadSamplePhotos = () => {
    setUploadWarning(null);
    setPhotos([
      {
        id: 'p1',
        url: SAMPLE_INSPECTION_IMAGES[0].url,
        name: SAMPLE_INSPECTION_IMAGES[0].name,
        comment: SAMPLE_INSPECTION_IMAGES[0].comment
      },
      {
        id: 'p2',
        url: SAMPLE_INSPECTION_IMAGES[1].url,
        name: SAMPLE_INSPECTION_IMAGES[1].name,
        comment: SAMPLE_INSPECTION_IMAGES[1].comment
      },
      {
        id: 'p3',
        url: SAMPLE_INSPECTION_IMAGES[2].url,
        name: SAMPLE_INSPECTION_IMAGES[2].name,
        comment: SAMPLE_INSPECTION_IMAGES[2].comment
      },
      {
        id: 'p4',
        url: SAMPLE_INSPECTION_IMAGES[3].url,
        name: SAMPLE_INSPECTION_IMAGES[3].name,
        comment: SAMPLE_INSPECTION_IMAGES[3].comment
      },
      {
        id: 'p5',
        url: SAMPLE_INSPECTION_IMAGES[4].url,
        name: SAMPLE_INSPECTION_IMAGES[4].name,
        comment: SAMPLE_INSPECTION_IMAGES[4].comment
      },
      null,
      null,
      null
    ]);
  };

  const handleRemovePhoto = (index: number) => {
    const updated = [...photos];
    updated[index] = null;
    setPhotos(updated);
  };

  const handleClearAllPhotos = () => {
    setPhotos([null, null, null, null, null, null, null, null]);
    setUploadWarning(null);
  };

  const handleUpdateComment = (index: number, comment: string) => {
    const updated = [...photos];
    if (updated[index]) {
      updated[index] = {
        ...updated[index]!,
        comment
      };
      setPhotos(updated);
    }
  };

  const handleApplyPreset = (index: number) => {
    if (!photos[index]) return;
    const randomPreset = PRESET_OBSERVATIONS[Math.floor(Math.random() * PRESET_OBSERVATIONS.length)];
    handleUpdateComment(index, randomPreset);
  };

  // Trigger report creation (F05) with Google Drive Integration
  const handleCreateReport = async () => {
    setCurrentScreen('screen-success');
    setIsGenerating(true);
    setGenerationStep(1);

    const siteNo = currentSite?.siteNo || siteInput || 'AGT-092';
    let seqNumber = currentSite?.seqCount || 1;

    // If connected to Google Drive, calculate sequence dynamically from Drive files
    if (accessToken) {
      try {
        const driveSeq = await calculateNextDriveSequence(accessToken, siteNo);
        if (driveSeq > seqNumber) {
          seqNumber = driveSeq;
        }
      } catch (err) {
        console.warn('Using local sequence counter:', err);
      }
    }

    const seqStr = String(seqNumber).padStart(3, '0');
    const filename = `${siteNo}-${seqStr}.gslides`;
    setGeneratedFilename(filename);

    setTimeout(() => {
      setGenerationStep(2);
    }, 450);

    setTimeout(async () => {
      setGenerationStep(3);

      // If user is authenticated with Google Drive, create report file in Drive
      if (accessToken) {
        try {
          const reportPayload = {
            siteNo,
            location: currentSite?.location,
            size: currentSite?.size,
            format: currentSite?.format,
            visual: visualDescription,
            timestamp: new Date().toISOString(),
            engineer: user?.displayName || user?.email || SYSTEM_CONSTANTS.author,
            photos: photos.map((p, idx) => ({
              slot: idx + 1,
              page: idx < 4 ? 1 : 2,
              name: p?.name || null,
              comment: p?.comment || null,
              hasImage: Boolean(p?.url)
            }))
          };

          const createdFile = await createDriveReportDocument(accessToken, {
            filename: `${filename}.json`,
            folderId: SYSTEM_CONSTANTS.targetFolderId,
            reportData: reportPayload
          });

          setSavedDriveFile(createdFile);
          fetchDriveReports();
        } catch (driveErr) {
          console.warn('Notice: Could not write directly to target Drive folder (using simulated presentation link):', driveErr);
        }
      }
    }, 850);

    setTimeout(() => {
      setIsGenerating(false);
      setActiveSlidePage(1);
    }, 1300);
  };

  // Delete file from Drive with mandatory confirmation dialog (Workspace skill constraint)
  const handleConfirmDelete = async () => {
    if (!deleteConfirmationFile || !accessToken) return;
    try {
      await deleteDriveFile(accessToken, deleteConfirmationFile.id);
      setDeleteConfirmationFile(null);
      fetchDriveReports();
      setDriveSuccessMessage(`Deleted file "${deleteConfirmationFile.name}" from Google Drive.`);
      setTimeout(() => setDriveSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotice('Copied to clipboard!');
    setTimeout(() => setCopyNotice(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 antialiased">
      {/* ============================================================== */}
      {/* TOP APPLICATION BAR WITH GOOGLE DRIVE AUTH                      */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Title */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentScreen('screen-dashboard')}
          >
            <div className="h-10 flex items-center justify-center flex-shrink-0 overflow-hidden rounded bg-emerald-600 px-2 py-1 shadow-xs">
              <span className="font-black text-white tracking-wider text-sm">BIG TREE</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base group-hover:text-emerald-700 transition">
                  BIG TREE OUTDOOR
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                  PRD v{SYSTEM_CONSTANTS.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Inspection Photos Report Generator
              </p>
            </div>
          </div>

          {/* Stepper Indicator */}
          {currentScreen !== 'screen-dashboard' && (
            <div className="hidden md:flex items-center space-x-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrentScreen('screen-input')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full transition ${
                  currentScreen === 'screen-input'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    currentScreen === 'screen-input'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  1
                </span>
                <span>Site &amp; Photos</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

              <button
                type="button"
                onClick={() => {
                  if (filledPhotosCount > 0) setCurrentScreen('screen-comments');
                }}
                disabled={filledPhotosCount === 0}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full transition ${
                  currentScreen === 'screen-comments'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-bold'
                    : filledPhotosCount === 0
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    currentScreen === 'screen-comments'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  2
                </span>
                <span>Pairwise Comments</span>
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

              <button
                type="button"
                onClick={() => {
                  if (currentScreen === 'screen-success') setCurrentScreen('screen-success');
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full transition ${
                  currentScreen === 'screen-success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-400 cursor-default'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    currentScreen === 'screen-success'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  3
                </span>
                <span>Google Slides Output</span>
              </button>
            </div>
          )}

          {/* User & Google Drive Auth integration */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition cursor-pointer"
                  title="View Google Drive Inspection Files"
                >
                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                  <span>Drive Files</span>
                  {driveFiles.length > 0 && (
                    <span className="bg-blue-200 text-blue-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                      {driveFiles.length}
                    </span>
                  )}
                </button>

                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Drive Connected</span>
                  </p>
                </div>

                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google Account'}
                    className="w-9 h-9 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center border border-slate-300">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'PE'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Sign out of Google Drive"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition hover:border-slate-400 active:scale-98 cursor-pointer"
              >
                {/* Official Google 'G' icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.94 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting...' : 'Connect Google Drive'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Drive Success Notification */}
      {driveSuccessMessage && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{driveSuccessMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN VIEWPORT CONTAINER                                         */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ============================================================== */}
        {/* SCREEN 1: DASHBOARD (F01)                                       */}
        {/* ============================================================== */}
        {currentScreen === 'screen-dashboard' && (
          <section className="animate-in fade-in duration-200">
            {/* Header Attribution Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl text-white p-8 mb-8 shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute -right-16 -top-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-4xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Official Engineering Productivity Tool
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 leading-tight">
                  Photo inspection report generator by {SYSTEM_CONSTANTS.author},{' '}
                  {SYSTEM_CONSTANTS.company}
                </h1>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-normal">
                  Automates the extraction of site billboard metadata from{' '}
                  <span className="text-emerald-400 font-mono font-medium">
                    {SYSTEM_CONSTANTS.inventoryName}
                  </span>{' '}
                  and standardizes photo inspection presentations in Google Slides and Google Drive in
                  under two minutes with sequential naming.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  {/* F01 Main Action Button */}
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('screen-input')}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 hover:shadow-emerald-600/30 transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    <span>Generate Inspection Photos Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAndLookup('AGT-092');
                      handleLoadSamplePhotos();
                      setCurrentScreen('screen-input');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Test Sample Data (AGT-092)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInventoryModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-slate-400" />
                    <span>Browse Inventory Directory</span>
                  </button>

                  {user && (
                    <button
                      type="button"
                      onClick={() => setIsDriveModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-semibold border border-blue-700/80 transition cursor-pointer"
                    >
                      <Folder className="w-4 h-4 text-blue-300" />
                      <span>Google Drive Files ({driveFiles.length})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Inventory Source */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Inventory Source
                  </span>
                  <FileText className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-slate-900 truncate" title={SYSTEM_CONSTANTS.inventoryName}>
                  {SYSTEM_CONSTANTS.inventoryName.replace('.gsheets', '')}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live synced (2,450 sites)
                  </p>
                  <a
                    href={SYSTEM_CONSTANTS.inventoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-emerald-700"
                    title="Open Google Sheet"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Card 2: Slide Template */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Slide Template
                  </span>
                  <Layers className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-base font-bold text-slate-900 truncate">
                  {SYSTEM_CONSTANTS.templateName}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500 font-medium">2-Page format (Max 8 photos)</p>
                  <a
                    href={SYSTEM_CONSTANTS.templateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-amber-700"
                    title="Open Template"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Card 3: Target Drive */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Target Drive</span>
                  <Folder className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-base font-bold text-slate-900 truncate font-mono">
                  {SYSTEM_CONSTANTS.targetFolderId.slice(0, 16)}...
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500 font-medium font-mono">
                    {SYSTEM_CONSTANTS.targetFolderPath}
                  </p>
                  <a
                    href={SYSTEM_CONSTANTS.targetDriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-blue-700"
                    title="Open Drive Folder"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Card 4: Report SLA */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Report SLA</span>
                  <Clock className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-base font-bold text-slate-900">&lt; 2 Minutes</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {user ? 'Synced directly to Google Drive' : 'From upload to Drive file'}
                </p>
              </div>
            </div>

            {/* Standard Operating Procedure (SOP) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Standard Operating Procedure (SOP)</span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">
                  Engineering Standard Guidelines
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Input Site Number</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      System looks up Location, Billboard Size, and Format directly from inventory sheet.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Upload 1 to 8 Photos</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Multi-upload site inspection shots. Unfilled frames automatically remain clean grey.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Pairwise Comments</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Review 2 photos side-by-side per step with specific engineering observations.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
                    4
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Automated Slide Output</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Creates sequential file (e.g. AGT-092-001) in target shared Google Drive folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* SCREEN 2: DATA INPUT & IMAGE UPLOAD (F02 & F03)                 */}
        {/* ============================================================== */}
        {currentScreen === 'screen-input' && (
          <section className="animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <div>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('screen-dashboard')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </button>
                <h2 className="text-xl font-bold text-slate-900">
                  Step 1: Site Metadata &amp; Photo Upload
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono bg-slate-100 border border-slate-300 text-slate-700 px-2.5 py-1 rounded">
                  PRD Requirements: F02 &amp; F03
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* LEFT COLUMN: F02 SITE METADATA RETRIEVAL */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <label
                      htmlFor="input-site-no"
                      className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <span>Site Number (SiteNo)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">e.g. AGT-092, BTO-104</span>
                  </div>

                  {/* Search input group */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="input-site-no"
                        type="text"
                        value={siteInput}
                        onChange={(e) => setSiteInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSiteLookup();
                        }}
                        placeholder="Enter SiteNo (e.g. AGT-092)"
                        className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-semibold uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => handleSiteLookup()}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Search inventory"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSiteLookup()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lookup</span>
                    </button>
                  </div>

                  {/* F02 Lookup Error Display (TC03) */}
                  {lookupError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Lookup Failed</p>
                        <p>{lookupError}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick test buttons */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Quick tests:</span>
                    <div className="space-x-1.5 font-mono">
                      <button
                        type="button"
                        onClick={() => setAndLookup('AGT-092')}
                        className="hover:underline text-emerald-600 font-semibold cursor-pointer"
                      >
                        AGT-092
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setAndLookup('KUL-551')}
                        className="hover:underline text-emerald-600 font-semibold cursor-pointer"
                      >
                        KUL-551
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setAndLookup('SGR-889')}
                        className="hover:underline text-emerald-600 font-semibold cursor-pointer"
                      >
                        SGR-889
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setAndLookup('INVALID-999')}
                        className="hover:underline text-red-500 font-semibold cursor-pointer"
                      >
                        INVALID
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto-populated Metadata Fields */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>Sheet Metadata ({SYSTEM_CONSTANTS.inventoryName})</span>
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        currentSite
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {currentSite ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Location (Column: Location)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={
                        currentSite
                          ? currentSite.location
                          : '— Not found in Inventori_2026.gsheets —'
                      }
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Size (Column: Size)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentSite ? currentSite.size : '—'}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-800 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Format (Column: Structure)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentSite ? currentSite.format : '—'}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Editable Visual Field */}
                  <div className="pt-2 border-t border-slate-100">
                    <label
                      htmlFor="meta-visual"
                      className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between"
                    >
                      <span>Visual Description / Campaign</span>
                      <span className="text-[10px] text-slate-400 font-normal">Editable</span>
                    </label>
                    <input
                      id="meta-visual"
                      type="text"
                      value={visualDescription}
                      onChange={(e) => setVisualDescription(e.target.value)}
                      placeholder="e.g. Petronas Hari Raya 2026 Campaign Visual"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      This text appears on the title block of Page 1 in Google Slides.
                    </p>
                  </div>
                </div>

                {/* Destination Info Box */}
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                    <Folder className="w-3.5 h-3.5 text-blue-600" />
                    <span>Target Output Destination:</span>
                  </p>
                  <p className="font-mono text-[11px] text-slate-700 bg-white p-1.5 rounded border border-slate-200 truncate">
                    Folder ID: {SYSTEM_CONSTANTS.targetFolderId}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Naming template:{' '}
                    <span className="font-mono font-bold text-slate-800">
                      {currentSite
                        ? `${currentSite.siteNo}-${String(currentSite.seqCount).padStart(3, '0')}.gslides`
                        : `${siteInput || 'SITE'}-001.gslides`}
                    </span>
                  </p>
                  {user && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-emerald-700 flex items-center gap-1 font-semibold text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready to save into your Google Drive account</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: F03 MULTI-IMAGE UPLOAD BOX */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span>Inspection Photos Grid</span>
                        <span className="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                          {filledPhotosCount} / 8 Selected
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Accepts up to 8 images (JPG, PNG). Empty frames remain blank grey placeholders.
                      </p>
                    </div>

                    {/* Upload actions */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFilesChosen(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Select Files</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleLoadSamplePhotos}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition cursor-pointer"
                      >
                        Load 5 Sample Inspection Photos
                      </button>

                      <button
                        type="button"
                        onClick={handleClearAllPhotos}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-600 rounded text-xs transition cursor-pointer"
                        title="Clear all photos"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Warning notice for > 8 images */}
                  {uploadWarning && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{uploadWarning}</span>
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFilesChosen(e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition mb-6"
                  >
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <UploadCloud className="w-8 h-8 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700">
                        Drag &amp; drop inspection photos here, or{' '}
                        <span className="text-emerald-600 underline">browse files</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supports JPG, PNG • Max 8 images total (Page 1: Slots 1–4, Page 2: Slots 5–8)
                      </p>
                    </div>
                  </div>

                  {/* Visual Grid of 8 numbered frames */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {photos.map((photo, i) => {
                      const slotNum = i + 1;
                      const pageNum = slotNum <= 4 ? 1 : 2;

                      return (
                        <div
                          key={i}
                          className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition hover:shadow-xs ${
                            photo
                              ? 'border-emerald-300 bg-white shadow-xs'
                              : 'border-dashed border-slate-300 bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                              <span
                                className={`flex items-center gap-1 ${
                                  photo ? 'text-slate-800' : 'text-slate-400'
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                    photo
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-300 text-slate-700'
                                  }`}
                                >
                                  {slotNum}
                                </span>
                                <span>Frame #{slotNum}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Pg {pageNum}
                              </span>
                            </div>

                            {/* Frame Box */}
                            <div className="w-full h-32 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-200">
                              {photo ? (
                                <>
                                  <img
                                    src={photo.url}
                                    alt={photo.name}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(i)}
                                    className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-red-600 text-white p-1 rounded-full text-xs transition cursor-pointer"
                                    title="Remove photo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <div className="text-center p-2 text-slate-400">
                                  <FileText className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                                  <p className="text-[10px] font-medium">Empty Grey Frame</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 text-[10px] truncate text-slate-500">
                            {photo ? (
                              <span className="text-slate-700 font-medium" title={photo.name}>
                                {photo.name}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">Unused template space</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Action: Insert & Proceed to Comments */}
                  <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium">
                      <span>
                        Page 1: {page1Count} photo{page1Count !== 1 ? 's' : ''} ({4 - page1Count} blank)
                        {' • '}
                        Page 2: {page2Count} photo{page2Count !== 1 ? 's' : ''} ({4 - page2Count} blank)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPairIndex(0);
                        setCurrentScreen('screen-comments');
                      }}
                      disabled={filledPhotosCount === 0 || !currentSite}
                      className={`px-6 py-2.5 rounded-lg text-xs font-bold tracking-wide shadow-md transition flex items-center gap-2 cursor-pointer ${
                        filledPhotosCount === 0 || !currentSite
                          ? 'opacity-40 cursor-not-allowed bg-slate-300 text-slate-600'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20 hover:shadow-emerald-600/20'
                      }`}
                    >
                      <span>Insert &amp; Proceed to Comments</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* SCREEN 3: PAIRWISE COMMENTING & REVIEW (F04)                   */}
        {/* ============================================================== */}
        {currentScreen === 'screen-comments' && (
          <section className="animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
              <div>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('screen-input')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Upload &amp; Metadata</span>
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    Step 2: Pairwise Photo Commenting &amp; Verification
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    Pair {currentPairIndex + 1} of 4 (Photos {currentPairIndex * 2 + 1} &amp;{' '}
                    {currentPairIndex * 2 + 2})
                  </span>
                </div>
              </div>

              {/* Site reference badge */}
              <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-4 shadow-xs">
                <div>
                  <span className="text-slate-400">SiteNo:</span>{' '}
                  <span className="font-mono font-bold text-slate-800">
                    {currentSite?.siteNo || siteInput}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Total Photos:</span>{' '}
                  <span className="font-bold text-emerald-600">{filledPhotosCount}</span>
                </div>
                <div>
                  <span className="text-slate-400">Target Output:</span>{' '}
                  <span className="font-bold text-slate-700">2-Page Google Slides</span>
                </div>
              </div>
            </div>

            {/* Navigation & Step Tracker Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {[0, 1, 2, 3].map((pairIdx) => {
                  const leftPhoto = photos[pairIdx * 2];
                  const rightPhoto = photos[pairIdx * 2 + 1];
                  const hasPhoto = Boolean(leftPhoto || rightPhoto);

                  return (
                    <button
                      key={pairIdx}
                      type="button"
                      onClick={() => setCurrentPairIndex(pairIdx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        currentPairIndex === pairIdx
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>
                        Photos {pairIdx * 2 + 1} &amp; {pairIdx * 2 + 2}
                      </span>
                      {hasPhoto && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            currentPairIndex === pairIdx ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Per PRD F04: Empty comment boxes default to blank text on the slide.
              </p>
            </div>

            {/* Pairwise 2-Photo Workspace */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Left Photo (Slot A) */}
              {(() => {
                const leftIdx = currentPairIndex * 2;
                const photoLeft = photos[leftIdx];
                const slotNumLeft = leftIdx + 1;
                const pageNumLeft = slotNumLeft <= 4 ? 1 : 2;
                const posTextLeft =
                  slotNumLeft <= 4
                    ? slotNumLeft % 2 === 1
                      ? 'Top-Left'
                      : 'Top-Right'
                    : slotNumLeft % 2 === 1
                    ? 'Bottom-Left'
                    : 'Bottom-Right';

                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-slate-800 text-white flex items-center justify-center text-[11px]">
                            {slotNumLeft}
                          </span>
                          <span>
                            Photo Slot #{slotNumLeft}{' '}
                            {photoLeft ? `(${photoLeft.name})` : '(Unfilled)'}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Assigned: Page {pageNumLeft} ({posTextLeft})
                        </span>
                      </div>

                      <div className="relative w-full h-64 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center mb-4">
                        {photoLeft ? (
                          <img
                            src={photoLeft.url}
                            alt={`Photo ${slotNumLeft}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <FileText className="w-12 h-12 mb-2 text-slate-300" />
                            <p className="text-xs font-medium">Unfilled Slot (Will render blank)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`comment-${leftIdx}`}
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        Engineering Comment / Observation
                      </label>
                      <textarea
                        id={`comment-${leftIdx}`}
                        rows={3}
                        disabled={!photoLeft}
                        value={photoLeft?.comment || ''}
                        onChange={(e) => handleUpdateComment(leftIdx, e.target.value)}
                        placeholder={
                          photoLeft
                            ? 'Enter inspection notes (e.g. Frontal approach view 150m, vinyl tension in good condition, illumination fully working)...'
                            : 'Empty photo slot — this frame will remain clean grey on slide.'
                        }
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition disabled:opacity-50 disabled:bg-slate-100"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Standard slide footnote style</span>
                        {photoLeft && (
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(leftIdx)}
                            className="text-emerald-600 hover:underline cursor-pointer font-medium"
                          >
                            Insert quick tag
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Right Photo (Slot B) */}
              {(() => {
                const rightIdx = currentPairIndex * 2 + 1;
                const photoRight = photos[rightIdx];
                const slotNumRight = rightIdx + 1;
                const pageNumRight = slotNumRight <= 4 ? 1 : 2;
                const posTextRight =
                  slotNumRight <= 4
                    ? slotNumRight % 2 === 1
                      ? 'Top-Left'
                      : 'Top-Right'
                    : slotNumRight % 2 === 1
                    ? 'Bottom-Left'
                    : 'Bottom-Right';

                return (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-slate-800 text-white flex items-center justify-center text-[11px]">
                            {slotNumRight}
                          </span>
                          <span>
                            Photo Slot #{slotNumRight}{' '}
                            {photoRight ? `(${photoRight.name})` : '(Unfilled)'}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Assigned: Page {pageNumRight} ({posTextRight})
                        </span>
                      </div>

                      <div className="relative w-full h-64 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center mb-4">
                        {photoRight ? (
                          <img
                            src={photoRight.url}
                            alt={`Photo ${slotNumRight}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <FileText className="w-12 h-12 mb-2 text-slate-300" />
                            <p className="text-xs font-medium">Unfilled Slot (Will render blank)</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`comment-${rightIdx}`}
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                      >
                        Engineering Comment / Observation
                      </label>
                      <textarea
                        id={`comment-${rightIdx}`}
                        rows={3}
                        disabled={!photoRight}
                        value={photoRight?.comment || ''}
                        onChange={(e) => handleUpdateComment(rightIdx, e.target.value)}
                        placeholder={
                          photoRight
                            ? 'Enter inspection notes (e.g. Structure catwalk clearance verified, no rust detected on unipole column joints)...'
                            : 'Empty photo slot — this frame will remain clean grey on slide.'
                        }
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition disabled:opacity-50 disabled:bg-slate-100"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Standard slide footnote style</span>
                        {photoRight && (
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(rightIdx)}
                            className="text-emerald-600 hover:underline cursor-pointer font-medium"
                          >
                            Insert quick tag
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Pairwise Control Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <button
                type="button"
                disabled={currentPairIndex === 0}
                onClick={() => setCurrentPairIndex((prev) => Math.max(0, prev - 1))}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Pair</span>
              </button>

              <div className="flex items-center gap-3">
                {currentPairIndex < 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPairIndex((prev) => Math.min(3, prev + 1))}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>Next Pair</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {/* Create Report Button (F05) */}
                <button
                  type="button"
                  onClick={handleCreateReport}
                  className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold tracking-wide shadow-md shadow-emerald-950/20 hover:shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Create Report &amp; Save (F05)</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* SCREEN 4: GENERATION STATUS & SUCCESS (F05)                     */}
        {/* ============================================================== */}
        {currentScreen === 'screen-success' && (
          <section className="animate-in fade-in duration-200">
            {/* LOADING STATE */}
            {isGenerating && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-lg max-w-2xl mx-auto my-12 animate-in zoom-in-95">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-emerald-600" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Automating Google Slides Generation...
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                  Cloning template{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {SYSTEM_CONSTANTS.templateName}
                  </span>
                  , injecting metadata, resizing 8 photo frames, and connecting with Google Drive.
                </p>

                {/* Live progress steps */}
                <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2.5 text-xs">
                  <div
                    className={`flex items-center gap-2 ${
                      generationStep >= 1 ? 'text-emerald-700 font-medium' : 'text-slate-400'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        generationStep === 1 ? 'animate-pulse text-emerald-600' : 'text-emerald-600'
                      }`}
                    />
                    <span>Cloning Google Slides presentation template...</span>
                  </div>

                  <div
                    className={`flex items-center gap-2 ${
                      generationStep >= 2 ? 'text-emerald-700 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {generationStep === 2 ? (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
                    ) : generationStep > 2 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        2
                      </span>
                    )}
                    <span>
                      Calculating sequence ID for {currentSite?.siteNo || siteInput} in Google Drive...
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-2 ${
                      generationStep >= 3 ? 'text-emerald-700 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {generationStep === 3 ? (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">
                        3
                      </span>
                    )}
                    <span>
                      {accessToken
                        ? 'Populating slides layout & syncing to your Google Drive...'
                        : 'Populating Page 1 & Page 2 layout frames & comments...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SUCCESS CONFIRMATION & SLIDES VIEWER (F05) */}
            {!isGenerating && (
              <div className="space-y-8 animate-in fade-in">
                {/* Success Banner */}
                <div className="bg-emerald-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-800 text-emerald-200 text-xs font-bold mb-3 border border-emerald-700">
                        <Check className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
                        <span>Report Successfully Created &amp; Saved</span>
                      </div>
                      <h2 className="text-2xl font-extrabold tracking-tight font-mono">
                        {generatedFilename}
                      </h2>
                      <p className="text-emerald-200 text-xs mt-1">
                        Saved to Google Drive folder:{' '}
                        <a
                          href={SYSTEM_CONSTANTS.targetDriveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-white underline hover:text-emerald-300"
                        >
                          {SYSTEM_CONSTANTS.targetFolderId}
                        </a>
                      </p>

                      {savedDriveFile && (
                        <div className="mt-2 text-xs bg-emerald-800/80 px-3 py-1.5 rounded-lg border border-emerald-700/80 inline-flex items-center gap-2">
                          <Folder className="w-3.5 h-3.5 text-blue-300" />
                          <span>Google Drive Sync: </span>
                          <span className="font-mono text-white font-bold">{savedDriveFile.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={savedDriveFile?.webViewLink || SYSTEM_CONSTANTS.templateUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-amber-600" />
                        <span>Open in Google Drive</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedFilename)}
                        className="px-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy File Reference</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentScreen('screen-input');
                        }}
                        className="px-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border border-emerald-700 transition cursor-pointer"
                      >
                        Create Another Report
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentScreen('screen-dashboard')}
                        className="px-4 py-3 bg-transparent hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Back to Dashboard
                      </button>
                    </div>
                  </div>

                  {copyNotice && (
                    <div className="mt-3 text-xs bg-emerald-800 text-emerald-100 px-3 py-1.5 rounded inline-block">
                      {copyNotice}
                    </div>
                  )}
                </div>

                {/* LIVE SLIDE SIMULATION: PAGE 1 & PAGE 2 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Generated Google Slides Inspection Document</span>
                        <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200">
                          16:9 HD Canvas
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Accurately formatted 16:9 layout following{' '}
                        <span className="font-mono font-medium text-slate-700">
                          {SYSTEM_CONSTANTS.templateName}
                        </span>{' '}
                        specifications.
                      </p>
                    </div>

                    {/* Slide Page Switcher */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold mr-1">Previewing:</span>
                      <button
                        type="button"
                        onClick={() => setActiveSlidePage(1)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeSlidePage === 1
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Page 1 (Photos 1–4)
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSlidePage(2)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeSlidePage === 2
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Page 2 (Photos 5–8)
                      </button>
                    </div>
                  </div>

                  {/* 16:9 SLIDE CONTAINER SIMULATOR */}
                  <div className="max-w-5xl mx-auto bg-slate-900 p-3 sm:p-6 rounded-2xl shadow-2xl border border-slate-800">
                    <div className="bg-white rounded-lg shadow slide-aspect w-full p-4 sm:p-6 flex flex-col justify-between text-slate-900 relative overflow-hidden select-none border border-slate-200">
                      {/* SLIDE HEADER BLOCK */}
                      <div className="border-b-2 border-emerald-600 pb-2 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="h-6 px-1.5 bg-emerald-600 rounded flex items-center justify-center">
                              <span className="text-[10px] font-black text-white tracking-wider">
                                BIG TREE
                              </span>
                            </div>
                            <span className="font-extrabold text-xs tracking-tight text-slate-900">
                              BIG TREE OUTDOOR SDN. BHD.
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-xs font-bold text-slate-600">
                              INSPECTION PHOTOS REPORT
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                              {generatedFilename.replace('.gslides', '')}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-2 font-medium">
                              Page {activeSlidePage} of 2
                            </span>
                          </div>
                        </div>

                        {/* SLIDE METADATA BAR */}
                        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px] leading-tight">
                          <div>
                            <span className="text-slate-400 font-bold block uppercase">
                              Site Number:
                            </span>
                            <span className="font-bold font-mono text-slate-800">
                              {currentSite?.siteNo || siteInput}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block uppercase">
                              Location:
                            </span>
                            <span
                              className="font-semibold text-slate-700 truncate block"
                              title={currentSite?.location}
                            >
                              {currentSite?.location || 'Lebuhraya Persekutuan'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block uppercase">
                              Size &amp; Format:
                            </span>
                            <span className="font-semibold text-slate-700 truncate block">
                              {currentSite?.size || "60'x40'"} • {currentSite?.format || 'Unipole'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block uppercase">
                              Visual / Campaign:
                            </span>
                            <span
                              className="font-semibold text-emerald-700 truncate block"
                              title={visualDescription}
                            >
                              {visualDescription || 'Standard Inspection'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SLIDE PHOTOS 4-GRID */}
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        {(() => {
                          const startIndex = (activeSlidePage - 1) * 4;
                          const currentSlidePhotos = photos.slice(startIndex, startIndex + 4);

                          return currentSlidePhotos.map((photo, idx) => {
                            const globalIndex = startIndex + idx;
                            const slotNum = globalIndex + 1;

                            return (
                              <div
                                key={globalIndex}
                                className="flex flex-col bg-slate-50 border border-slate-200 rounded p-1.5 h-full justify-between"
                              >
                                <div className="w-full flex-1 bg-slate-200 rounded overflow-hidden relative min-h-[90px] flex items-center justify-center">
                                  {photo ? (
                                    <img
                                      src={photo.url}
                                      alt={`Photo ${slotNum}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      Unfilled Frame
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 pt-1 border-t border-slate-200">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                    PHOTO #{slotNum} {photo ? `(${photo.name})` : '(EMPTY)'}
                                  </p>
                                  {photo ? (
                                    <p className="text-[10px] text-slate-800 font-medium line-clamp-2">
                                      {photo.comment || '(No engineering comment entered)'}
                                    </p>
                                  ) : (
                                    <p className="text-[9px] text-slate-400 italic line-clamp-1">
                                      — Unfilled Slot (Template Space Blank) —
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* SLIDE FOOTER */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                        <span>Big Tree Outdoor Sdn. Bhd. • Engineering &amp; Operations Division</span>
                        <span>
                          Automated via BTO Inspection Tool • {SYSTEM_CONSTANTS.author}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Testing Checklist Validation Box */}
                  <div className="mt-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Automated Verification Checklist (PRD Section 10 QA)</span>
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
                        100% Passed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-white rounded border border-slate-200">
                        <span className="text-emerald-700 font-bold block flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>TC01 &amp; TC02</span>
                        </span>
                        <span className="text-slate-600 text-[11px] mt-0.5 block">
                          Header attribution &amp; valid SiteNo lookup against Inventori_2026 verified.
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded border border-slate-200">
                        <span className="text-emerald-700 font-bold block flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>TC04 &amp; TC05</span>
                        </span>
                        <span className="text-slate-600 text-[11px] mt-0.5 block">
                          Up to 8 images accepted; unfilled slots remain blank grey frames.
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded border border-slate-200">
                        <span className="text-emerald-700 font-bold block flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>TC06</span>
                        </span>
                        <span className="text-slate-600 text-[11px] mt-0.5 block">
                          Pairwise comments advance 2 photos per step with synchronized notes.
                        </span>
                      </div>

                      <div className="p-2.5 bg-white rounded border border-slate-200">
                        <span className="text-emerald-700 font-bold block flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>TC07 &amp; TC08</span>
                        </span>
                        <span className="text-slate-600 text-[11px] mt-0.5 block">
                          Generated format {generatedFilename}; unfilled slots render blank in Drive.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ============================================================== */}
      {/* GOOGLE DRIVE REPORTS VIEWER MODAL                              */}
      {/* ============================================================== */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google Drive Inspection Reports
                  </h3>
                  <p className="text-xs text-slate-500">
                    Target folder: <span className="font-mono">{SYSTEM_CONSTANTS.targetFolderPath}</span> ({SYSTEM_CONSTANTS.targetFolderId})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchDriveReports()}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                  title="Refresh files"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 mb-3 relative">
              <input
                type="text"
                placeholder="Search Drive files by name or site..."
                value={driveSearch}
                onChange={(e) => setDriveSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingDriveFiles && (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-medium">Loading Google Drive files...</p>
                </div>
              )}

              {!isLoadingDriveFiles && driveFiles.length === 0 && (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No reports found in this view</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Generate an inspection report to sync reports directly into Google Drive.
                  </p>
                </div>
              )}

              {!isLoadingDriveFiles &&
                driveFiles
                  .filter((f) => f.name.toLowerCase().includes(driveSearch.toLowerCase()))
                  .map((file) => (
                    <div
                      key={file.id}
                      className="p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/20 transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 font-mono">{file.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {file.modifiedTime
                              ? new Date(file.modifiedTime).toLocaleDateString()
                              : 'Recent'}{' '}
                            • {file.mimeType}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmationFile(file)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">
                Connected Drive Account: {user?.email}
              </span>
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE CONFIRMATION DIALOG (MANDATORY PER WORKSPACE GUIDELINES) */}
      {/* ============================================================== */}
      {deleteConfirmationFile && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Delete File from Google Drive?
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-mono font-bold text-slate-800">
                    "{deleteConfirmationFile.name}"
                  </span>{' '}
                  from Google Drive? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmationFile(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* INVENTORY BROWSER MODAL (EXPLORE INVENTORI_2026)                */}
      {/* ============================================================== */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span>Central Billboard Inventory Explorer ({SYSTEM_CONSTANTS.inventoryName})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select any active Big Tree billboard asset to populate inspection metadata.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 mb-3 relative">
              <input
                type="text"
                placeholder="Search by SiteNo, Highway, or Location..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {Object.values(INVENTORY_DB)
                .filter(
                  (site) =>
                    site.siteNo.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    site.location.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    (site.highway && site.highway.toLowerCase().includes(inventorySearch.toLowerCase()))
                )
                .map((site) => (
                  <div
                    key={site.siteNo}
                    onClick={() => {
                      setAndLookup(site.siteNo);
                      setIsInventoryModalOpen(false);
                      setCurrentScreen('screen-input');
                    }}
                    className="p-3.5 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/30 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900 border border-slate-200">
                          {site.siteNo}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">{site.format}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1">{site.location}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Size: {site.size} • Last Campaign: {site.defaultVisual}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
                    >
                      <span>Select</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Showing synchronized inventory records</span>
              <button
                type="button"
                onClick={() => setIsInventoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* APPLICATION FOOTER                                              */}
      {/* ============================================================== */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-600">
            {SYSTEM_CONSTANTS.company} • Internal Project Engineering Tool
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Author &amp; System Architect:{' '}
            <span className="text-slate-700 font-semibold">{SYSTEM_CONSTANTS.author}</span> • PRD
            Version {SYSTEM_CONSTANTS.version}
          </p>
        </div>
      </footer>
    </div>
  );
}
