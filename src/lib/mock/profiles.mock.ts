import type { BandwidthProfile } from "../types";

export const initialProfiles: BandwidthProfile[] = [
  {
    id: "prof-1",
    name: "Paket Hemat 5 Mbps",
    rateLimitDown: 5,
    rateLimitUp: 2,
    price: 100000,
    description:
      "Paket internet ekonomis untuk kebutuhan browsing dan chat ringan keluarga kecil.",
    customerCount: 3,
  },
  {
    id: "prof-2",
    name: "Paket Home 10 Mbps",
    rateLimitDown: 10,
    rateLimitUp: 5,
    price: 165000,
    description:
      "Paket standar streaming video Full HD YouTube, Netflix, dan WFH harian.",
    customerCount: 6,
  },
  {
    id: "prof-3",
    name: "Paket Ultra 20 Mbps",
    rateLimitDown: 20,
    rateLimitUp: 10,
    price: 250000,
    description:
      "Cocok untuk keluarga aktif dengan 4-6 perangkat terkoneksi secara bersamaan.",
    customerCount: 4,
  },
  {
    id: "prof-4",
    name: "Paket Gamer 50 Mbps",
    rateLimitDown: 50,
    rateLimitUp: 25,
    price: 400000,
    description:
      "Prioritas latency rendah untuk online gaming, live streaming, dan download file besar.",
    customerCount: 2,
  },
  {
    id: "prof-5",
    name: "Paket Bisnis 100 Mbps",
    rateLimitDown: 100,
    rateLimitUp: 50,
    price: 750000,
    description:
      "Bandwidth dedicated untuk kantor, cafe, warnet, dan server lokal.",
    customerCount: 1,
  },
];
