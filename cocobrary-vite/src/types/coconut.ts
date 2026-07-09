export type CoconutAccessory =
  | "sunglasses"
  | "ornament"
  | "hair"
  | "flower"
  | "hulaSkirt"
  | "ribbon"
  | "nameLabel";

export type CoconutConfig = {
  albumId?: string;
  persisted?: boolean;
  baseImage: string;
  accessories: CoconutAccessory[];
  label?: string;
  sunglassesImage?: string;
  skirtImage?: string;
  accessoryImage?: string;
  accessoryTopImage?: string;
  accessoryBottomImage?: string;
  hairImage?: string;
  colors?: {
    flower?: string;
    ribbon?: string;
    skirt?: string;
    label?: string;
  };
};

export type SavedCoconut = {
  id: string;
  nickname: string;
  createdAt: string;
  config: CoconutConfig;
};
