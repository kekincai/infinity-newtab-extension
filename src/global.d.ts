declare const chrome: any;

interface Navigator {
    getBattery?: () => Promise<{
        level: number;
        charging: boolean;
    }>;
}
