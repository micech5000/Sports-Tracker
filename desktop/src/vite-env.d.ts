/// <reference types="vite/client" />

interface Window {
  sportsTracker?: {
    platform: NodeJS.Platform;
    updateNow: () => Promise<void>;
    getSettings: () => Promise<{
      notificationsEnabled: boolean;
      startWithWindows: boolean;
    }>;
    setSettings: (settings: {
      notificationsEnabled?: boolean;
      startWithWindows?: boolean;
    }) => Promise<{
      notificationsEnabled: boolean;
      startWithWindows: boolean;
    }>;
    onEventsUpdated: (callback: () => void) => () => void;
  };
}
