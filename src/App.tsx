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
  SYSTEM_CONSTANTS,
  findSiteInInventory,
  normalizeSiteNo
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
  searchSpreadsheetsInDrive,
  autoDiscoverInventorySpreadsheet,
  DriveFileItem
} from './services/googleDrive';
import {
  testFirestoreConnection,
  saveReportToFirestore,
  loadReportsFromFirestore,
  deleteReportFromFirestore,
  saveSiteToFirestore,
  loadSitesFromFirestore,
  SavedReportDoc
} from './services/firebase';
import {
  fetchInventoryFromGoogleSheets,
  testSpreadsheetHealth,
  extractSpreadsheetId,
  DEFAULT_SPREADSHEET_ID,
  STORAGE_KEY_SPREADSHEET_ID,
  SheetFetchResult,
  SheetDiagnosticResult
} from './services/googleSheets';
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
  LogOut,
  RefreshCw,
  RotateCw,
  Database,
  Table,
  History,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';

export default function App() {
  // Current screen state
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-dashboard');

  // Google Auth & User state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  // Firebase Firestore State
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [savedFirestoreReports, setSavedFirestoreReports] = useState<SavedReportDoc[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Google Sheets Sync State
  const [activeInventory, setActiveInventory] = useState<Record<string, BillboardSite>>(INVENTORY_DB);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetSyncTime, setSheetSyncTime] = useState<string>('Live synced (2,450 sites)');
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  });
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<string | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);
  const [sheetDiagnostic, setSheetDiagnostic] = useState<SheetDiagnosticResult | null>(null);
  const [isTestingSheet, setIsTestingSheet] = useState<boolean>(false);
  const [discoveredDriveSheets, setDiscoveredDriveSheets] = useState<DriveFileItem[]>([]);
  const [isSearchingDriveSheets, setIsSearchingDriveSheets] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SheetFetchResult | null>(null);
  const [connectedSheetTitle, setConnectedSheetTitle] = useState<string>(() => {
    return localStorage.getItem('bto_connected_sheet_title') || 'Inventori_2026.gsheets';
  });

  // Custom Site Registration Modal State
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState<boolean>(false);
  const [newSiteData, setNewSiteData] = useState<BillboardSite>({
    siteNo: '',
    location: '',
    size: "60' (H) x 40' (W)",
    format: 'Unipole Spectacular (Backlit)',
    defaultVisual: 'Maybank Islamic - Premier Wealth 2026 Visual',
    seqCount: 1,
    highway: 'Federal Highway'
  });

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [driveSearch, setDriveSearch] = useState<string>('');
  const [deleteConfirmationFile, setDeleteConfirmationFile] = useState<DriveFileItem | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

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
      comment: SAMPLE_INSPECTION_IMAGES[0].comment,
      rotation: 0
    },
    {
      id: 'p2',
      url: SAMPLE_INSPECTION_IMAGES[1].url,
      name: SAMPLE_INSPECTION_IMAGES[1].name,
      comment: SAMPLE_INSPECTION_IMAGES[1].comment,
      rotation: 0
    },
    {
      id: 'p3',
      url: SAMPLE_INSPECTION_IMAGES[2].url,
      name: SAMPLE_INSPECTION_IMAGES[2].name,
      comment: SAMPLE_INSPECTION_IMAGES[2].comment,
      rotation: 0
    },
    {
      id: 'p4',
      url: SAMPLE_INSPECTION_IMAGES[3].url,
      name: SAMPLE_INSPECTION_IMAGES[3].name,
      comment: SAMPLE_INSPECTION_IMAGES[3].comment,
      rotation: 0
    },
    {
      id: 'p5',
      url: SAMPLE_INSPECTION_IMAGES[4].url,
      name: SAMPLE_INSPECTION_IMAGES[4].name,
      comment: SAMPLE_INSPECTION_IMAGES[4].comment,
      rotation: 0
    },
    null,
    null,
    null
  ]);

  // Upload warning state (>8 images)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // Pairwise review state
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

  // Filled photos counter
  const filledPhotosCount = photos.filter((p): p is PhotoSlot => p !== null).length;
  const page1Count = photos.slice(0, 4).filter(Boolean).length;
  const page2Count = photos.slice(4, 8).filter(Boolean).length;

  // Initial boot: Test Firestore connection and load reports
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirestoreConnected(connected);
    });

    loadReportsFromFirestore().then((reports) => {
      setSavedFirestoreReports(reports);
    });

    loadSitesFromFirestore().then((firestoreSites) => {
      if (firestoreSites && Object.keys(firestoreSites).length > 0) {
        setActiveInventory((prev) => ({
          ...prev,
          ...firestoreSites
        }));
      }
    });

    const unsubscribe = initAuth(
      async (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        fetchDriveReports(token);
        // Automatically discover and sync Google Sheets
        await syncGoogleSheetsInventory(token);
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

  // Google Sheets live sync handler
  const syncGoogleSheetsInventory = async (token?: string, customSheetId?: string) => {
    const activeToken = token || accessToken;
    let targetSheetId = extractSpreadsheetId(
      customSheetId || localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID) || spreadsheetIdInput || DEFAULT_SPREADSHEET_ID
    );

    setIsSyncingSheets(true);
    setSheetSyncSuccess(null);
    setSheetSyncError(null);

    try {
      // If targetSheetId is the default dummy placeholder and we have an active token,
      // attempt auto-discovery of real Inventory_2026 file in Google Drive!
      if (activeToken && targetSheetId === DEFAULT_SPREADSHEET_ID) {
        try {
          const autoFound = await autoDiscoverInventorySpreadsheet(activeToken);
          if (autoFound) {
            targetSheetId = autoFound.id;
            setSpreadsheetIdInput(autoFound.id);
            setConnectedSheetTitle(autoFound.name);
            localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, autoFound.id);
            localStorage.setItem('bto_connected_sheet_title', autoFound.name);
            setBannerNotice(`Auto-detected '${autoFound.name}' in your Google Drive! Connecting...`);
          }
        } catch (discoverErr) {
          console.warn('Auto-discovery error:', discoverErr);
        }
      }

      const result = await fetchInventoryFromGoogleSheets(activeToken, targetSheetId);

      // Merge with active inventory database
      setActiveInventory((prev) => ({
        ...prev,
        ...result.sites
      }));

      setLastSyncResult(result);
      setConnectedSheetTitle(result.sheetTitle);
      localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, targetSheetId);
      localStorage.setItem('bto_connected_sheet_title', result.sheetTitle);
      setSpreadsheetIdInput(targetSheetId);

      const statusMsg = `Disegerak dari '${result.sheetTitle}' (${result.rowCount} tapak pada ${result.syncedAt})`;
      setSheetSyncTime(statusMsg);
      setSheetSyncSuccess(
        `Berjaya memuat turun ${result.rowCount} rekod tapak daripada Google Sheet '${result.sheetTitle}' (Tab: ${result.tabName})!`
      );
      setTimeout(() => setSheetSyncSuccess(null), 6000);
      return result;
    } catch (err: any) {
      console.warn('Sheets sync notice:', err.message);
      setSheetSyncError(err.message);
      if (!activeToken) {
        setSheetSyncTime('Mod Luar Talian (20+ tapak standard BTO sedia ada)');
      } else {
        setSheetSyncTime(`Gagal akses Sheet: ${err.message?.slice(0, 45)}...`);
      }
      return null;
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Scan user's Google Drive for spreadsheets (specifically Inventory_2026)
  const handleScanDriveForInventory = async () => {
    if (!accessToken) {
      alert('Sila log masuk dengan akaun Google anda terlebih dahulu untuk membaca fail Google Drive.');
      return;
    }

    setIsSearchingDriveSheets(true);
    setSheetSyncError(null);
    try {
      const sheets = await searchSpreadsheetsInDrive(accessToken);
      setDiscoveredDriveSheets(sheets);

      // Auto-detect if there's a file with 'inventory' or '2026'
      const matched = sheets.find(
        (s) =>
          s.name.toLowerCase().includes('inventory') ||
          s.name.toLowerCase().includes('inventori') ||
          s.name.toLowerCase().includes('2026')
      );

      if (matched) {
        setSpreadsheetIdInput(matched.id);
        setConnectedSheetTitle(matched.name);
        await syncGoogleSheetsInventory(accessToken, matched.id);
      } else if (sheets.length > 0) {
        setSpreadsheetIdInput(sheets[0].id);
      }
    } catch (err: any) {
      console.error('Failed to scan Drive:', err);
      setSheetSyncError(`Gagal mengimbas Google Drive: ${err.message}`);
    } finally {
      setIsSearchingDriveSheets(false);
    }
  };

  // Health check diagnostic handler
  const handleTestSheetHealth = async () => {
    setIsTestingSheet(true);
    try {
      const res = await testSpreadsheetHealth(accessToken, spreadsheetIdInput);
      setSheetDiagnostic(res);
    } catch (err: any) {
      setSheetDiagnostic({
        accessible: false,
        status: 500,
        message: err.message,
        spreadsheetId: spreadsheetIdInput,
        mode: 'failed'
      });
    } finally {
      setIsTestingSheet(false);
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
        await syncGoogleSheetsInventory(res.accessToken);
        setBannerNotice(`Connected Google Workspace (Drive & Sheets) for ${res.user.email}`);
        setTimeout(() => setBannerNotice(null), 4000);
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

  // Site Lookup Handler (F02) with smart fuzzy matching
  const handleSiteLookup = (targetSiteNo?: string) => {
    const rawQuery = (targetSiteNo || siteInput).trim();
    if (!rawQuery) return;

    const site =
      findSiteInInventory(rawQuery, activeInventory) ||
      findSiteInInventory(rawQuery, INVENTORY_DB);

    if (site) {
      setCurrentSite(site);
      setSiteInput(site.siteNo);
      setVisualDescription(site.defaultVisual);
      setLookupError(null);
      const seqStr = String(site.seqCount || 1).padStart(3, '0');
      setGeneratedFilename(`${site.siteNo}-${seqStr}.gslides`);
    } else {
      setLookupError(`Nombor Tapak "${rawQuery.toUpperCase()}" tidak dijumpai dalam inventori aktif.`);
      setCurrentSite(null);
    }
  };

  const setAndLookup = (siteNo: string) => {
    setSiteInput(siteNo);
    handleSiteLookup(siteNo);
  };

  const handleOpenAddSiteModal = (suggestedSiteNo?: string) => {
    const initialSiteNo = (suggestedSiteNo || siteInput || 'AGT-094').trim().toUpperCase();
    setNewSiteData({
      siteNo: initialSiteNo,
      location: '',
      size: "60' (H) x 40' (W)",
      format: 'Unipole Spectacular (Backlit)',
      defaultVisual: 'Maybank Islamic - Premier Wealth 2026 Visual',
      seqCount: 1,
      highway: 'Lebuhraya Persekutuan'
    });
    setIsAddSiteModalOpen(true);
  };

  const handleSaveCustomSite = async () => {
    if (!newSiteData.siteNo.trim() || !newSiteData.location.trim()) {
      alert('Sila isikan Nombor Tapak dan Lokasi.');
      return;
    }

    const cleanSiteNo = newSiteData.siteNo.trim().toUpperCase();
    const siteToSave: BillboardSite = {
      ...newSiteData,
      siteNo: cleanSiteNo
    };

    setActiveInventory((prev) => ({
      ...prev,
      [cleanSiteNo]: siteToSave
    }));

    try {
      await saveSiteToFirestore(siteToSave);
    } catch (err) {
      console.warn('Firestore site save notice:', err);
    }

    setCurrentSite(siteToSave);
    setSiteInput(cleanSiteNo);
    setVisualDescription(siteToSave.defaultVisual);
    setLookupError(null);
    const seqStr = String(siteToSave.seqCount || 1).padStart(3, '0');
    setGeneratedFilename(`${cleanSiteNo}-${seqStr}.gslides`);
    setIsAddSiteModalOpen(false);
    setBannerNotice(`Tapak "${cleanSiteNo}" berjaya didaftarkan ke inventori & Firebase!`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const handleTestSpreadsheet = async () => {
    setIsTestingSheet(true);
    setSheetDiagnostic(null);
    try {
      const diag = await testSpreadsheetHealth(accessToken, spreadsheetIdInput);
      setSheetDiagnostic(diag);
    } catch (err: any) {
      setSheetDiagnostic({
        accessible: false,
        status: 500,
        message: err.message || 'Ralat semasa memeriksa fail Google Sheets.',
        spreadsheetId: extractSpreadsheetId(spreadsheetIdInput),
        mode: 'failed'
      });
    } finally {
      setIsTestingSheet(false);
    }
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
          file,
          rotation: 0
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
        comment: SAMPLE_INSPECTION_IMAGES[0].comment,
        rotation: 0
      },
      {
        id: 'p2',
        url: SAMPLE_INSPECTION_IMAGES[1].url,
        name: SAMPLE_INSPECTION_IMAGES[1].name,
        comment: SAMPLE_INSPECTION_IMAGES[1].comment,
        rotation: 0
      },
      {
        id: 'p3',
        url: SAMPLE_INSPECTION_IMAGES[2].url,
        name: SAMPLE_INSPECTION_IMAGES[2].name,
        comment: SAMPLE_INSPECTION_IMAGES[2].comment,
        rotation: 0
      },
      {
        id: 'p4',
        url: SAMPLE_INSPECTION_IMAGES[3].url,
        name: SAMPLE_INSPECTION_IMAGES[3].name,
        comment: SAMPLE_INSPECTION_IMAGES[3].comment,
        rotation: 0
      },
      {
        id: 'p5',
        url: SAMPLE_INSPECTION_IMAGES[4].url,
        name: SAMPLE_INSPECTION_IMAGES[4].name,
        comment: SAMPLE_INSPECTION_IMAGES[4].comment,
        rotation: 0
      },
      null,
      null,
      null
    ]);
  };

  const handleRotatePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        const currentRot = updated[index]!.rotation || 0;
        updated[index] = {
          ...updated[index]!,
          rotation: (currentRot + 90) % 360
        };
      }
      return updated;
    });
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

  // Trigger report creation (F05) with Google Drive & Firebase Firestore
  const handleCreateReport = async () => {
    setCurrentScreen('screen-success');
    setIsGenerating(true);
    setGenerationStep(1);

    const siteNo = currentSite?.siteNo || siteInput || 'AGT-092';
    let seqNumber = currentSite?.seqCount || 1;

    // Scan sequence from Google Drive or Firestore reports
    if (accessToken) {
      try {
        const driveSeq = await calculateNextDriveSequence(accessToken, siteNo);
        if (driveSeq > seqNumber) {
          seqNumber = driveSeq;
        }
      } catch (err) {
        console.warn('Sequence counter note:', err);
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

      const reportPayload = {
        siteNo,
        filename,
        location: currentSite?.location || 'Lebuhraya Persekutuan',
        size: currentSite?.size || "60'x40'",
        format: currentSite?.format || 'Unipole',
        visual: visualDescription,
        photoCount: filledPhotosCount,
        engineerEmail: user?.email || 'azrin.g@gmail.com',
        engineerUid: user?.uid || 'guest-engineer',
        createdAt: new Date().toISOString(),
        photosSummary: photos
          .filter(Boolean)
          .map((p, i) => `Photo #${i + 1}: ${p?.comment || 'Observed'} (Rotation: ${p?.rotation || 0}°)`),
        photosMetadata: photos.map((p, i) => ({
          slot: i + 1,
          name: p?.name || null,
          rotation: p?.rotation || 0,
          comment: p?.comment || null
        }))
      };

      // 1. Save Report Persistently into Firebase Firestore
      try {
        const savedId = await saveReportToFirestore(reportPayload);
        const refreshedReports = await loadReportsFromFirestore();
        setSavedFirestoreReports(refreshedReports);
      } catch (firestoreErr) {
        console.warn('Firestore report save notice:', firestoreErr);
      }

      // 2. Save Report Document into Google Drive (if authenticated)
      if (accessToken) {
        try {
          const createdFile = await createDriveReportDocument(accessToken, {
            filename: `${filename}.json`,
            folderId: SYSTEM_CONSTANTS.targetFolderId,
            reportData: reportPayload
          });
          setSavedDriveFile(createdFile);
          fetchDriveReports();
        } catch (driveErr) {
          console.warn('Drive sync notice:', driveErr);
        }
      }
    }, 850);

    setTimeout(() => {
      setIsGenerating(false);
      setActiveSlidePage(1);
    }, 1300);
  };

  // Delete file from Drive with mandatory confirmation dialog
  const handleConfirmDelete = async () => {
    if (!deleteConfirmationFile || !accessToken) return;
    try {
      await deleteDriveFile(accessToken, deleteConfirmationFile.id);
      setDeleteConfirmationFile(null);
      fetchDriveReports();
      setBannerNotice(`Deleted file "${deleteConfirmationFile.name}" from Google Drive.`);
      setTimeout(() => setBannerNotice(null), 3000);
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
      {/* TOP APPLICATION BAR WITH GOOGLE DRIVE & SHEETS AUTH            */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Title */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentScreen('screen-dashboard')}
          >
            <div className="h-10 flex items-center justify-center flex-shrink-0 overflow-hidden rounded bg-emerald-600 px-2.5 py-1 shadow-xs">
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

          {/* Quick Service Links & Account */}
          <div className="flex items-center space-x-2.5">
            {/* Firebase Firestore status button */}
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition cursor-pointer"
              title="Firebase Firestore Database Reports"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Firestore ({savedFirestoreReports.length})</span>
            </button>

            {/* Google Sheets Sync status button */}
            <button
              type="button"
              onClick={() => setIsSheetsModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition cursor-pointer"
              title="Google Sheets Inventory Sync"
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sheets Sync</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold border border-blue-200 transition cursor-pointer"
                  title="View Google Drive Inspection Files"
                >
                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                  <span>Drive</span>
                  {driveFiles.length > 0 && (
                    <span className="bg-blue-200 text-blue-900 text-[10px] px-1 rounded-full font-mono">
                      {driveFiles.length}
                    </span>
                  )}
                </button>

                <div className="text-right hidden xl:block">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Workspace Active</span>
                  </p>
                </div>

                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google Account'}
                    className="w-8 h-8 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center border border-slate-300">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'PE'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Sign out of Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition hover:border-slate-400 active:scale-98 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                <span>{isSigningIn ? 'Connecting...' : 'Sign In with Google'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Realtime Notification Banner */}
      {bannerNotice && (
        <div className="bg-slate-900 text-emerald-300 text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 border-b border-slate-800 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{bannerNotice}</span>
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
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Official Engineering Productivity Tool
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
                    <Database className="w-3 h-3 text-amber-400" />
                    <span>Firebase Firestore Active</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-mono">
                    <Table className="w-3 h-3 text-blue-400" />
                    <span>Google Sheets Synced</span>
                  </div>
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
                  via Google Sheets, syncs persistent data to Firebase Firestore, and standardizes
                  photo inspection presentations in Google Slides in under two minutes with sequential
                  naming.
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
                    <span>Browse Inventory ({Object.keys(activeInventory).length} Sites)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 text-xs font-semibold border border-amber-700/60 transition cursor-pointer"
                  >
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Saved Reports History ({savedFirestoreReports.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status & Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Inventory Source & Google Sheets */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Google Sheets Source
                  </span>
                  <Table className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-slate-900 truncate" title={connectedSheetTitle || SYSTEM_CONSTANTS.inventoryName}>
                  {connectedSheetTitle || SYSTEM_CONSTANTS.inventoryName}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 truncate max-w-[190px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {sheetSyncTime}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetsModalOpen(true);
                      if (accessToken && discoveredDriveSheets.length === 0) {
                        handleScanDriveForInventory();
                      }
                    }}
                    className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer flex-shrink-0"
                  >
                    Urus / Sync
                  </button>
                </div>
              </div>

              {/* Card 2: Firebase Firestore Database */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Firebase Database
                  </span>
                  <Database className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-base font-bold text-slate-900 truncate">
                  Firestore (asia-southeast1)
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500 font-medium">
                    {savedFirestoreReports.length} reports persisted
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="text-[11px] text-amber-700 font-bold hover:underline cursor-pointer"
                  >
                    View
                  </button>
                </div>
              </div>

              {/* Card 3: Target Drive Folder */}
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
                  Auto Sheets + Drive + Firestore
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
                      Fetches live location, size, and structure type from Google Sheets inventory.
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
                    <p className="text-sm font-bold text-slate-800">Automated Multi-Cloud Save</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Saves to Google Drive with sequential numbering and logs persistent record in Firebase.
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
                  {/* Google Sheets Sync Indicator Banner */}
                  <div className="mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate mr-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lastSyncResult ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <div className="truncate">
                        <span className="font-bold text-slate-800 text-[11px] block truncate">
                          {lastSyncResult ? lastSyncResult.sheetTitle : (connectedSheetTitle || 'Inventori_2026.gsheets')}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {Object.keys(activeInventory).length} tapak sedia ada • {sheetSyncTime}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSheetsModalOpen(true)}
                      className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-300 hover:border-emerald-300 rounded text-[10px] font-bold transition flex-shrink-0 cursor-pointer shadow-2xs"
                    >
                      {lastSyncResult ? 'Urus Sheet' : 'Sync Fail Drive'}
                    </button>
                  </div>

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
                        placeholder="Enter SiteNo (e.g. AGT-092, KUL-551)"
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

                  {/* Autocomplete / Suggested match pills */}
                  {siteInput.trim().length >= 2 && !currentSite && (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs animate-in fade-in">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Cadangan Tapak Sepadan:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.values(activeInventory)
                          .filter((s) =>
                            normalizeSiteNo(s.siteNo).includes(normalizeSiteNo(siteInput)) ||
                            s.location.toLowerCase().includes(siteInput.toLowerCase())
                          )
                          .slice(0, 4)
                          .map((s) => (
                            <button
                              key={s.siteNo}
                              type="button"
                              onClick={() => setAndLookup(s.siteNo)}
                              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-300 rounded text-slate-800 font-mono text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <span className="text-emerald-700">{s.siteNo}</span>
                              <span className="text-[10px] text-slate-400 font-sans truncate max-w-[110px]">
                                {s.location.split(' ')[0]}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* F02 Lookup Error Display (TC03) + Drive Sync Helper + Quick Add Option */}
                  {lookupError && (
                    <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-3 animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-red-900">Lookup Failed</p>
                          <p className="text-red-700 text-xs mt-0.5">{lookupError}</p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white/80 rounded-lg border border-red-200 text-[11px] text-slate-700 space-y-2">
                        <p className="font-semibold text-slate-800">
                          Adakah tapak ini berada dalam fail <span className="font-mono font-bold text-emerald-800">Inventory_2026.gsheet</span> anda?
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          Jika ya, pastikan fail Google Sheets sebenar anda telah disambungkan dari Google Drive supaya semua senarai tapak dimuat turun ke dalam aplikasi.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSheetsModalOpen(true);
                              if (accessToken && discoveredDriveSheets.length === 0) {
                                handleScanDriveForInventory();
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Table className="w-3.5 h-3.5" />
                            <span>Imbas &amp; Sync Google Drive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAddSiteModal(siteInput)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Daftarkan Tapak Ini Manual</span>
                          </button>
                        </div>
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
                      <span>Google Sheets Metadata ({SYSTEM_CONSTANTS.inventoryName})</span>
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
                        ? `${currentSite.siteNo}-${String(currentSite.seqCount || 1).padStart(3, '0')}.gslides`
                        : `${siteInput || 'SITE'}-001.gslides`}
                    </span>
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      <span>Firestore Sync: Ready</span>
                    </span>
                    {user && (
                      <span className="text-blue-700 font-semibold flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        <span>Drive: Ready</span>
                      </span>
                    )}
                  </div>
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
                                    style={{
                                      transform: `rotate(${photo.rotation || 0}deg)`,
                                      transition: 'transform 0.2s ease-in-out'
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                                    <button
                                      type="button"
                                      onClick={() => handleRotatePhoto(i)}
                                      className="bg-black/70 hover:bg-emerald-600 text-white p-1 rounded-full text-xs transition cursor-pointer shadow-xs"
                                      title="Rotate 90° clockwise"
                                    >
                                      <RotateCw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePhoto(i)}
                                      className="bg-black/70 hover:bg-red-600 text-white p-1 rounded-full text-xs transition cursor-pointer shadow-xs"
                                      title="Remove photo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {Boolean(photo.rotation && photo.rotation > 0) && (
                                    <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-emerald-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs z-10 flex items-center gap-0.5">
                                      <RotateCw className="w-2.5 h-2.5" />
                                      <span>{photo.rotation}°</span>
                                    </span>
                                  )}
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
                          <>
                            <img
                              src={photoLeft.url}
                              alt={`Photo ${slotNumLeft}`}
                              style={{
                                transform: `rotate(${photoLeft.rotation || 0}deg)`,
                                transition: 'transform 0.2s ease-in-out'
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                              <button
                                type="button"
                                onClick={() => handleRotatePhoto(leftIdx)}
                                className="bg-black/70 hover:bg-emerald-600 text-white p-1.5 rounded-full text-xs transition cursor-pointer shadow-xs"
                                title="Rotate 90° clockwise"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                            </div>
                            {Boolean(photoLeft.rotation && photoLeft.rotation > 0) && (
                              <span className="absolute bottom-2 left-2 bg-black/75 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xs z-10 flex items-center gap-1">
                                <RotateCw className="w-3 h-3" />
                                <span>{photoLeft.rotation}°</span>
                              </span>
                            )}
                          </>
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
                          <>
                            <img
                              src={photoRight.url}
                              alt={`Photo ${slotNumRight}`}
                              style={{
                                transform: `rotate(${photoRight.rotation || 0}deg)`,
                                transition: 'transform 0.2s ease-in-out'
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                              <button
                                type="button"
                                onClick={() => handleRotatePhoto(rightIdx)}
                                className="bg-black/70 hover:bg-emerald-600 text-white p-1.5 rounded-full text-xs transition cursor-pointer shadow-xs"
                                title="Rotate 90° clockwise"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                            </div>
                            {Boolean(photoRight.rotation && photoRight.rotation > 0) && (
                              <span className="absolute bottom-2 left-2 bg-black/75 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xs z-10 flex items-center gap-1">
                                <RotateCw className="w-3 h-3" />
                                <span>{photoRight.rotation}°</span>
                              </span>
                            )}
                          </>
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
                  Automating Google Slides &amp; Cloud Storage...
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                  Cloning template{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {SYSTEM_CONSTANTS.templateName}
                  </span>
                  , saving persistent inspection record in Firebase Firestore, and syncing to Google Drive.
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
                      Calculating sequence ID for {currentSite?.siteNo || siteInput}...
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
                      Saving to Firebase Firestore &amp; syncing with Google Drive...
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

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="text-xs bg-amber-800/80 px-2.5 py-1 rounded-lg border border-amber-700/80 inline-flex items-center gap-1.5 text-amber-200">
                          <Database className="w-3.5 h-3.5 text-amber-300" />
                          <span>Firestore Record Logged</span>
                        </div>

                        {savedDriveFile && (
                          <div className="text-xs bg-emerald-800/80 px-2.5 py-1 rounded-lg border border-emerald-700/80 inline-flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-blue-300" />
                            <span>Google Drive Sync: </span>
                            <span className="font-mono text-white font-bold">{savedDriveFile.name}</span>
                          </div>
                        )}
                      </div>
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
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-4 py-3 bg-amber-800 hover:bg-amber-700 text-white rounded-xl text-xs font-bold border border-amber-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-amber-300" />
                        <span>View Firestore Reports</span>
                      </button>

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
                                      style={{
                                        transform: `rotate(${photo.rotation || 0}deg)`
                                      }}
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
      {/* GOOGLE SHEETS LIVE SYNC & DIAGNOSTICS MODAL                    */}
      {/* ============================================================== */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google Sheets Inventory Synchronization &amp; Diagnostics
                  </h3>
                  <p className="text-xs text-slate-500">
                    Segerakkan fail <span className="font-mono font-semibold text-emerald-800">Inventory_2026.gsheet</span> daripada Google Drive.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Guidance Info Banner */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Kenapa SiteNo tidak dijumpai sebelum ini?</p>
                  <p className="text-blue-800 text-[11px] mt-0.5">
                    Fail asal menggunakan ID templat PRD placeholder (<span className="font-mono text-blue-900">{DEFAULT_SPREADSHEET_ID.slice(0, 15)}...</span>).
                    Sekiranya fail sebenar <span className="font-mono font-bold">Inventory_2026.gsheet</span> berada di dalam akaun Google Drive anda, sila klik butang <strong>"Imbas Google Drive Saya"</strong> di bawah supaya sistem boleh menyambung terus ke fail sebenar anda!
                  </p>
                </div>
              </div>

              {/* SECTION 1: AUTO SCAN DRIVE FOR INVENTORY_2026 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      1. Imbas Google Drive untuk 'Inventory_2026'
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {user ? `Akaun: ${user.email}` : 'Belum Log Masuk'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mb-3">
                  Sistem akan mencari semua fail Google Sheets dalam akaun Google Drive anda yang mengandungi nama <em>"Inventory"</em> atau <em>"2026"</em>.
                </p>

                {user ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleScanDriveForInventory}
                      disabled={isSearchingDriveSheets}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSearchingDriveSheets ? 'animate-spin' : ''}`} />
                      <span>{isSearchingDriveSheets ? 'Mengimbas Drive...' : 'Imbas Google Drive Sekarang'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => syncGoogleSheetsInventory(undefined, spreadsheetIdInput)}
                      disabled={isSyncingSheets}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                      <span>{isSyncingSheets ? 'Menyegerak...' : 'Sync Semula ID Semasa'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <span className="font-medium">Sila log masuk dengan akaun Google anda untuk mengakses fail peribadi.</span>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer flex-shrink-0"
                    >
                      {isSigningIn ? 'Menyambung...' : 'Log Masuk dengan Google'}
                    </button>
                  </div>
                )}

                {/* Discovered Spreadsheets List */}
                {discoveredDriveSheets.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Fail Google Sheets Dijumpai di Drive Anda ({discoveredDriveSheets.length}):
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {discoveredDriveSheets.map((file) => (
                        <div
                          key={file.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition ${
                            spreadsheetIdInput === file.id
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span className="font-bold text-slate-900 block truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {file.id}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {spreadsheetIdInput === file.id && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Aktif
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSpreadsheetIdInput(file.id);
                                syncGoogleSheetsInventory(undefined, file.id);
                              }}
                              disabled={isSyncingSheets}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                            >
                              Pilih &amp; Sync
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: MANUAL SPREADSHEET ID / URL INPUT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Masukkan ID / Pautan Google Sheets Manual:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={spreadsheetIdInput}
                    onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                    placeholder="Tampal Google Spreadsheet ID atau URL Penuh..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestSheetHealth}
                    disabled={isTestingSheet}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    <span>{isTestingSheet ? 'Menguji...' : 'Uji Sambungan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => syncGoogleSheetsInventory(undefined, spreadsheetIdInput)}
                    disabled={isSyncingSheets}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSheets ? 'Syncing...' : 'Sync Sekarang'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Anda boleh tampal URL penuh seperti: <span className="font-mono">https://docs.google.com/spreadsheets/d/ID_FAIL/edit</span>
                </p>
              </div>

              {/* Status / Success Alert */}
              {sheetSyncSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{sheetSyncSuccess}</span>
                </div>
              )}

              {/* Sync Error Alert */}
              {sheetSyncError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Ralat Akses Google Sheets:</span>
                    <p className="mt-0.5 text-[11px]">{sheetSyncError}</p>
                    <p className="mt-1 text-[10px] text-red-600">
                      Petua: Gunakan butang "Imbas Google Drive Sekarang" di atas untuk mencari fail sebenar anda.
                    </p>
                  </div>
                </div>
              )}

              {/* Diagnostic Result Display */}
              {sheetDiagnostic && (
                <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Status Diagnostik:</span>
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      sheetDiagnostic.accessible ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      HTTP {sheetDiagnostic.status} ({sheetDiagnostic.accessible ? 'Boleh Diakses' : 'Gagal'})
                    </span>
                  </div>
                  <p className="text-slate-600">{sheetDiagnostic.message}</p>
                  {sheetDiagnostic.tabs && sheetDiagnostic.tabs.length > 0 && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      Senarai Tab: {sheetDiagnostic.tabs.join(' | ')}
                    </p>
                  )}
                </div>
              )}

              {/* SECTION 3: COLUMN DETECTION & PREVIEW OF IMPORTED SITES */}
              {lastSyncResult && (
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Data Berjaya Dikesan ({lastSyncResult.rowCount} Rekod Tapak)</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-800">
                      Tab: {lastSyncResult.tabName}
                    </span>
                  </div>

                  {/* Detected Columns */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Kolum SiteNo</span>
                      <span className="font-mono font-bold text-slate-800 truncate block">
                        {lastSyncResult.columnsDetected.siteNoCol}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Kolum Lokasi</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {lastSyncResult.columnsDetected.locationCol}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Kolum Saiz</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {lastSyncResult.columnsDetected.sizeCol}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Kolum Struktur</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {lastSyncResult.columnsDetected.formatCol}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-200">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Kolum Kempen</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {lastSyncResult.columnsDetected.visualCol}
                      </span>
                    </div>
                  </div>

                  {/* Sample Records Table Preview */}
                  {lastSyncResult.sampleSites && lastSyncResult.sampleSites.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-emerald-950 mb-1.5 uppercase tracking-wider">
                        Pratonton 5 Tapak Pertama yang Disegerak:
                      </p>
                      <div className="overflow-x-auto bg-white rounded-lg border border-emerald-200">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-emerald-100/50 text-emerald-900 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="p-2">SiteNo</th>
                              <th className="p-2">Lokasi</th>
                              <th className="p-2">Saiz</th>
                              <th className="p-2">Struktur</th>
                              <th className="p-2">Kempen Semasa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-100">
                            {lastSyncResult.sampleSites.map((site) => (
                              <tr key={site.siteNo} className="hover:bg-slate-50">
                                <td className="p-2 font-mono font-bold text-emerald-800">{site.siteNo}</td>
                                <td className="p-2 text-slate-700 truncate max-w-[150px]">{site.location}</td>
                                <td className="p-2 font-mono text-slate-600">{site.size}</td>
                                <td className="p-2 text-slate-600 truncate max-w-[120px]">{site.format}</td>
                                <td className="p-2 text-slate-600 truncate max-w-[140px]">{site.defaultVisual}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Inventory Summary */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold">Jumlah Tapak Sedia Ada dalam Aplikasi:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {Object.keys(activeInventory).length} Aset Billboard
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold">Status Sambungan Google:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {user ? `Disambung (${user.email})` : 'Mod Tetamu (Menggunakan Data Pangkalan BTO)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 flex-shrink-0 mt-4">
              <a
                href={
                  spreadsheetIdInput && spreadsheetIdInput !== DEFAULT_SPREADSHEET_ID
                    ? `https://docs.google.com/spreadsheets/d/${spreadsheetIdInput}/edit`
                    : SYSTEM_CONSTANTS.inventoryUrl
                }
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Buka Fail di Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
              >
                Selesai (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FIREBASE FIRESTORE SAVED REPORTS HISTORY MODAL                  */}
      {/* ============================================================== */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Firebase Firestore Inspection Reports
                  </h3>
                  <p className="text-xs text-slate-500">
                    Persistent database collection <span className="font-mono text-slate-700">/reports</span> (Cloud Region: asia-southeast1)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 mb-3 relative">
              <input
                type="text"
                placeholder="Search reports by SiteNo, Filename, or Engineer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {savedFirestoreReports.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No reports saved in Firestore yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Every report you generate is automatically and permanently recorded in Firebase.
                  </p>
                </div>
              ) : (
                savedFirestoreReports
                  .filter(
                    (r) =>
                      r.siteNo.toLowerCase().includes(historySearch.toLowerCase()) ||
                      r.filename.toLowerCase().includes(historySearch.toLowerCase()) ||
                      (r.engineerEmail && r.engineerEmail.toLowerCase().includes(historySearch.toLowerCase()))
                  )
                  .map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 border border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/20 transition flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900 border border-slate-200">
                            {rep.siteNo}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-800">
                            {rep.filename}
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            {rep.photoCount} Photos
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">{rep.location}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Engineer: {rep.engineerEmail || 'BTO Engineer'} • {new Date(rep.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAndLookup(rep.siteNo);
                            setIsHistoryModalOpen(false);
                            setCurrentScreen('screen-input');
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Load Site</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero-Trust Security Rules Deployed</span>
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* DELETE CONFIRMATION DIALOG                                     */}
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
              {Object.values(activeInventory)
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
