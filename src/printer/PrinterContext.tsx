import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { BluetoothDevice } from 'react-native-bluetooth-classic';
import { connectToDevice, disconnectDevice, listPairedDevices, sendBytes } from './bluetooth';
import { buildReceiptBytes, type ReceiptInput } from './receiptBuilder';
import { getSettings, setSettings } from '../db/repositories/settings';

interface PrinterContextValue {
  connectedName: string | null;
  connectedAddress: string | null;
  isConnecting: boolean;
  scanPairedDevices: () => Promise<BluetoothDevice[]>;
  connect: (device: BluetoothDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  printReceipt: (input: ReceiptInput) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const scanPairedDevices = useCallback(() => listPairedDevices(), []);

  const connect = useCallback(async (device: BluetoothDevice) => {
    setIsConnecting(true);
    try {
      await connectToDevice(device.address);
      setConnectedName(device.name ?? device.address);
      setConnectedAddress(device.address);
      await setSettings({ printerName: device.name ?? '', printerAddress: device.address });
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectedAddress) await disconnectDevice(connectedAddress);
    setConnectedName(null);
    setConnectedAddress(null);
  }, [connectedAddress]);

  const printReceipt = useCallback(
    async (input: ReceiptInput) => {
      if (!connectedAddress) throw new Error('No printer connected');
      const bytes = buildReceiptBytes(input);
      await sendBytes(connectedAddress, bytes);
    },
    [connectedAddress]
  );

  const value = useMemo(
    () => ({ connectedName, connectedAddress, isConnecting, scanPairedDevices, connect, disconnect, printReceipt }),
    [connectedName, connectedAddress, isConnecting, scanPairedDevices, connect, disconnect, printReceipt]
  );

  return <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>;
}

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter must be used within a PrinterProvider');
  return ctx;
}

/** Restores the last-connected printer (by address) from settings, if it's still paired and reachable. */
export async function tryReconnectSavedPrinter(): Promise<{ name: string; address: string } | null> {
  const settings = await getSettings();
  if (!settings.printerAddress) return null;
  try {
    await connectToDevice(settings.printerAddress);
    return { name: settings.printerName, address: settings.printerAddress };
  } catch {
    return null;
  }
}
