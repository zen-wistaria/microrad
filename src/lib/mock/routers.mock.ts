import type { NasRouter } from "../types";

export const initialRouters: NasRouter[] = [
  {
    id: "nas-1",
    name: "CCR2004-Core-DC",
    ipAddress: "192.168.88.1",
    location: "Data Center NOC Pusat (Rak A-02)",
    type: "mikrotik",
    status: "online",
    activeSessionCount: 5,
  },
  {
    id: "nas-2",
    name: "RB4011-Tower-Utara",
    ipAddress: "192.168.10.1",
    location: "Tower Pemancar RW 04 Utara",
    type: "mikrotik",
    status: "online",
    activeSessionCount: 2,
  },
  {
    id: "nas-3",
    name: "hEX-S-Distribusi-Barat",
    ipAddress: "192.168.20.1",
    location: "Pos Distribusi Cluster Melati Blok C",
    type: "mikrotik",
    status: "online",
    activeSessionCount: 1,
  },
  {
    id: "nas-4",
    name: "RB750Gr3-Node-Cadangan",
    ipAddress: "192.168.30.1",
    location: "Gudang Cadangan Sektor Selatan",
    type: "mikrotik",
    status: "offline",
    activeSessionCount: 0,
  },
];
