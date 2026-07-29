declare const chrome: any;

interface Navigator {
    deviceMemory?: number;
    getBattery?: () => Promise<{
        level: number;
        charging: boolean;
    }>;
}
