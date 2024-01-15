// Global API methods.
declare global {
  var mp: {
    get_property(name: string): string | undefined;
    get_property(name: string, def: string): string;

    [key: string]: any;
  };
}

// Additional types are kept in separated namespace to not be confused with official API.
export namespace MP {
  interface Track {
    id: number;
    type: "video" | "audio" | "sub";
    selected: boolean;
    external: boolean;
    "external-filename": string;
  }

  interface Filter {
    name: string;
    label?: string;
    enabled?: boolean;
    params?: { [key: string]: string };
  }

  interface Encoder {
    codec: string;
    description: string;
    driver: string;
  }
}
