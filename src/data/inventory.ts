import { BillboardSite, PhotoSlot } from '../types';

export const INVENTORY_DB: Record<string, BillboardSite> = {
  'AGT-092': {
    siteNo: 'AGT-092',
    location: 'Lebuhraya Persekutuan KM 14.2 (Arah KL), Shah Alam',
    size: "60' (H) x 40' (W)",
    format: 'Unipole Spectacular (Backlit)',
    defaultVisual: 'Maybank Islamic - Premier Wealth 2026 Visual',
    seqCount: 1,
    highway: 'Federal Highway (KM 14.2)',
    coordinates: '3.0722° N, 101.5208° E'
  },
  'KUL-551': {
    siteNo: 'KUL-551',
    location: 'Jalan Tun Razak (Opposite Menara TM), Kuala Lumpur',
    size: "40' (H) x 80' (W)",
    format: 'Digital LED Screen 4K',
    defaultVisual: 'Samsung Galaxy S26 Ultra Launch',
    seqCount: 3,
    highway: 'Jalan Tun Razak Corridor',
    coordinates: '3.1189° N, 101.6669° E'
  },
  'SGR-889': {
    siteNo: 'SGR-889',
    location: 'NKVE Subang Toll Plaza Gantry KM 11.5',
    size: "20' (H) x 120' (W)",
    format: 'Overhead Bridge Gantry',
    defaultVisual: 'Touch n Go RFID Nationwide Awareness',
    seqCount: 2,
    highway: 'New Klang Valley Expressway (NKVE)',
    coordinates: '3.1027° N, 101.5841° E'
  },
  'BTO-104': {
    siteNo: 'BTO-104',
    location: 'Sprint Highway KM 4.8 (Damansara Link heading Bangsar)',
    size: "50' (H) x 30' (W)",
    format: 'Monopole Backlit Static',
    defaultVisual: 'CelcomDigi 5G Home Fiber Blitz',
    seqCount: 1,
    highway: 'Sprint Expressway (KM 4.8)',
    coordinates: '3.1412° N, 101.6622° E'
  },
  'MY-NPE-02': {
    siteNo: 'MY-NPE-02',
    location: 'New Pantai Expressway (NPE) Sunway Toll Canopy',
    size: "30' (H) x 60' (W)",
    format: 'Toll Plaza Arch LED Screen',
    defaultVisual: 'Petronas Primax 97 with Pro-Drive',
    seqCount: 4,
    highway: 'New Pantai Expressway (NPE)',
    coordinates: '3.0733° N, 101.6067° E'
  },
  'LDP-420': {
    siteNo: 'LDP-420',
    location: 'Damansara-Puchong Highway (LDP) Kelana Jaya Overhead',
    size: "25' (H) x 100' (W)",
    format: 'Double Sided Gantry Static',
    defaultVisual: 'Shopee Super Brand Day 2026',
    seqCount: 2,
    highway: 'Damansara-Puchong Expressway (LDP)',
    coordinates: '3.1094° N, 101.5975° E'
  }
};

export const SAMPLE_INSPECTION_IMAGES: Array<{ url: string; name: string; comment: string }> = [
  {
    url: 'https://images.unsplash.com/photo-1542314831-c6a4d2757681?auto=format&fit=crop&w=800&q=80',
    name: 'AGT-092_Approach_150m.jpg',
    comment: 'Frontal approach view at 150m. Full visual clarity with no foliage or gantry obstruction.'
  },
  {
    url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb325?auto=format&fit=crop&w=800&q=80',
    name: 'AGT-092_Structure_Base.jpg',
    comment: 'Unipole foundation base and perimeter security fencing intact. No structural cracks or soil subsidence detected.'
  },
  {
    url: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80',
    name: 'AGT-092_Vinyl_Tension.jpg',
    comment: 'Vinyl tension clips intact. Catwalk safety harness lifeline cable inspected and compliant with JKKP/DOSH.'
  },
  {
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    name: 'AGT-092_Electrical_Box.jpg',
    comment: 'Main electrical distribution panel clean, breaker switches operational, photocell timer calibrated for 19:15 ignition.'
  },
  {
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    name: 'AGT-092_Night_Illumination.jpg',
    comment: 'Nighttime illumination test: All 8 floodlight LED luminaires firing at 100% capacity with uniform lux spread.'
  }
];

export const PRESET_OBSERVATIONS = [
  'Structure integrity verified. No corrosion found on structural unipole truss.',
  'Frontal approach line of sight 100% clear from KM 14.2 gantry view.',
  'Backlit neon tubes fully functional. Digital photocell sensor tested operational.',
  'Visual tensioning flat with no wrinkling or edge fraying along perimeter.',
  'Maintenance catwalk safety gate locked and anchor points secured.',
  'Ground earthing rod impedance measured at 2.4 Ohms (within safe limit < 5 Ohms).',
  'Daylight aesthetic inspection passed. Brand logo colors sharp without UV bleaching.'
];

export const SYSTEM_CONSTANTS = {
  version: '1.1',
  author: 'Ts. Azrin Helmi Bin Mohd Ghazali',
  company: 'Big Tree Outdoor Sdn. Bhd.',
  role: 'Internal Project Engineer',
  inventoryName: 'Inventori_2026.gsheets',
  inventoryUrl: 'https://docs.google.com/spreadsheets/d/1ZRHVQ0IBSJ8C3L86IFXDH8DYGVFYFYAHCNM9B_TPYEK',
  templateName: 'IPR_Sample.gslides',
  templateUrl: 'https://docs.google.com/presentation/d/1-lXKXd53YRH2N4i8uG-4zGI4Oe-pfkEm6MiCYDfCMdY/edit',
  targetFolderId: '13gDVVR5fnjpfN7CSULNzU2dXPH3HjaNE',
  targetFolderPath: 'BTO / Reports / 2026',
  targetDriveUrl: 'https://drive.google.com/drive/folders/13gDVVR5fnjpfN7CSULNzU2dXPH3HjaNE',
  logoUrlHeader: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBilgD3OyaEtcYvcw5kESZo7AoBFeceW9NJsEEOUu8b5BtlxYGlfxe_HpL5xiMMV5P3Qk2cV62qNjvz0teAmGa_0m5ZwjsCnkdsWVCbxA1_afHnabcXcd36K1v2BTb2yZLA_pwvWHvmcneNEzh07xqsfosCMmchmM-dkjOW4lHXn-wOvbw-4DtTp92uK1zwzpuCTl4bqzqvRq52rt_Jtc1BayaassY9xpklM3HiNN2dY4-KNOlfhqFagZt53CAnlXcIANk',
  logoUrlSlide: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC9yz-SIzDDN39KnVT0WRmq-AP81WXXxLcVpEGeWGxrggdp_JBHMPXYK1U26PaqMCdM0DQmpsFg-duPxmuP4_bQT7QlReDjuicBVDO9yubOvwBxKS7U0bONce4SOh4zKHq-peyI9zfEJDD7eaRYCWJS07rTLNfXv-vKj9cweU0YE-jWsxkaxdvMsegiJMtNn88m_bhjYuLTU72gRsk3RBPlxsQvbG2HetJv-q6cXccD12CJI55LLSa5ertrZoXP9cPnso'
};
