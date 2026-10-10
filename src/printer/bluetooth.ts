import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { fromByteArray } from 'base64-js';

export async function listPairedDevices(): Promise<BluetoothDevice[]> {
  return RNBluetoothClassic.getBondedDevices();
}

export async function connectToDevice(address: string): Promise<BluetoothDevice> {
  const alreadyConnected = await RNBluetoothClassic.isDeviceConnected(address).catch(() => false);
  if (alreadyConnected) {
    const connected = await RNBluetoothClassic.getConnectedDevice(address);
    if (connected) return connected;
  }
  return RNBluetoothClassic.connectToDevice(address);
}

export async function disconnectDevice(address: string): Promise<void> {
  await RNBluetoothClassic.disconnectFromDevice(address).catch(() => undefined);
}

export async function sendBytes(address: string, bytes: Uint8Array): Promise<void> {
  const base64 = fromByteArray(bytes);
  await RNBluetoothClassic.writeToDevice(address, base64, 'base64');
}
