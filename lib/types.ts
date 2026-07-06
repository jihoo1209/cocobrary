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

export type CoconutPosition = {
  x: number;
  y: number;
};

export type TripMember = {
  id: string;
  nickname: string;
  bio?: string;
  position: CoconutPosition;
  coconut: CoconutConfig;
};

export type PhotoTarget = {
  memberId: string;
};

export type AlbumPhoto = {
  id: string;
  tripId: string;
  uploaderName: string;
  caption: string;
  createdAt: string;
  imageUrl: string;
  targets: PhotoTarget[];
};

export type Trip = {
  id: string;
  databaseId?: string;
  name: string;
  location: string;
  dates: string;
  description: string;
  members: TripMember[];
  photos: AlbumPhoto[];
};
