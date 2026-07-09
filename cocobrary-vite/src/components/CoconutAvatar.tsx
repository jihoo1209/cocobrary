import clsx from "clsx";
import type { CoconutConfig } from "../types/coconut";

type CoconutAvatarProps = {
  config: CoconutConfig;
  size?: number;
  className?: string;
  imageLoading?: "eager" | "lazy";
};

function optimizeCoconutBaseImage(imagePath: string) {
  return imagePath.replace(/\/assets\/(coconut-0[1-4])\.png$/, "/assets/$1.webp");
}

export function CoconutAvatar({
  config,
  size = 116,
  className,
  imageLoading,
}: CoconutAvatarProps) {
  const labelPalette = ["#fff7d6", "#ffd8e8", "#d7f7eb", "#eadcff", "#e7dcff"];
  const hasAccessory = (name: string) => config.accessories.includes(name as never);
  const labelSeed = `${config.label ?? ""}-${config.baseImage}-${config.sunglassesImage ?? ""}-${config.skirtImage ?? ""}`;
  const fallbackLabelColor =
    labelPalette[
      Array.from(labelSeed).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        labelPalette.length
    ];
  const sunglassesStyles: Record<
    string,
    { left: string; top: string; width: string; rotate?: string; scaleY?: number }
  > = {
    "/assets/sunglasses-01.png": { left: "-3%", top: "21%", width: "106%", scaleY: 0.84 },
    "/assets/sunglasses-03.png": { left: "2%", top: "21%", width: "96%" },
    "/assets/sunglasses-04.png": { left: "3%", top: "23%", width: "94%" },
    "/assets/sunglasses-05.png": { left: "8%", top: "25%", width: "84%" },
    "/assets/sunglasses-06.png": { left: "12%", top: "28%", width: "76%" },
    "/assets/sunglasses-07.png": { left: "4%", top: "22%", width: "92%" },
  };
  const selectedSunglassesStyle = config.sunglassesImage
    ? sunglassesStyles[config.sunglassesImage]
    : null;
  const topAccessoryStyles: Record<
    string,
    { left: string; top: string; width: string; rotate?: string }
  > = {
    "/assets/accessory-01.png": { left: "12%", top: "60%", width: "26%" },
    "/assets/accessory-02.png": { left: "12%", top: "60%", width: "25%" },
    "/assets/accessory-03.png": { left: "13%", top: "60%", width: "24%" },
    "/assets/accessory-04.png": { left: "12%", top: "60%", width: "25%" },
  };
  const bottomAccessoryStyles: Record<
    string,
    { left: string; top: string; width: string; rotate?: string }
  > = {
    "/assets/accessory-05.png": { left: "60%", top: "14%", width: "27%" },
    "/assets/accessory-06.png": { left: "58%", top: "13%", width: "31%" },
    "/assets/accessory-07.png": { left: "58%", top: "8%", width: "31%" },
  };
  const selectedTopAccessoryStyle = config.accessoryTopImage
    ? topAccessoryStyles[config.accessoryTopImage]
    : null;
  const selectedBottomAccessoryStyle = config.accessoryBottomImage
    ? bottomAccessoryStyles[config.accessoryBottomImage]
    : null;
  const hairStyles: Record<
    string,
    { left: string; top: string; width: string; rotate?: string }
  > = {
    "/assets/hair-01.png": { left: "-10%", top: "-6%", width: "122%" },
    "/assets/hair-02.png": { left: "-12%", top: "-12%", width: "126%" },
    "/assets/hair-03.png": { left: "-10%", top: "-10%", width: "124%" },
    "/assets/hair-04.png": { left: "-14%", top: "-6%", width: "130%" },
    "/assets/hair-05.png": { left: "-20%", top: "-10%", width: "130%" },
  };
  const selectedHairStyle = config.hairImage ? hairStyles[config.hairImage] : null;
  const skirtStyles: Record<
    string,
    { left: string; top: string; width: string; rotate?: string; scaleY?: number }
  > = {
    "/assets/skirt-01.png": { left: "-8%", top: "70%", width: "116%", scaleY: 0.72 },
    "/assets/skirt-02.png": { left: "1%", top: "63%", width: "98%", scaleY: 0.68 },
    "/assets/skirt-03.png": { left: "8%", top: "63%", width: "94%", scaleY: 0.68 },
    "/assets/skirt-05.png": { left: "10%", top: "63%", width: "89%", scaleY: 0.84 },
  };
  const selectedSkirtStyle = config.skirtImage ? skirtStyles[config.skirtImage] : null;
  const baseImageSrc = optimizeCoconutBaseImage(config.baseImage);

  return (
    <div
      className={clsx("relative overflow-visible rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={baseImageSrc}
        alt={config.label ?? "Coconut avatar"}
        className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(78,50,29,0.28)]"
        loading={imageLoading}
        decoding="async"
        draggable={false}
      />

      {hasAccessory("hulaSkirt") && config.skirtImage && selectedSkirtStyle ? (
        <div
          className="absolute"
          style={{
            left: selectedSkirtStyle.left,
            top: selectedSkirtStyle.top,
            width: selectedSkirtStyle.width,
            transform:
              [
                selectedSkirtStyle.rotate ? `rotate(${selectedSkirtStyle.rotate})` : "",
                selectedSkirtStyle.scaleY ? `scaleY(${selectedSkirtStyle.scaleY})` : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
            transformOrigin: "top center",
          }}
        >
          <div className="relative aspect-[2.4/1.2] w-full">
            <img
              src={config.skirtImage}
              alt="Skirt accessory"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : hasAccessory("hulaSkirt") ? (
        <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 items-end gap-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <span
              key={index}
              className="block rounded-b-full"
              style={{
                width: 8,
                height: 16 + (index % 2) * 6,
                backgroundColor: config.colors?.skirt ?? "#8ed081",
              }}
            />
          ))}
        </div>
      ) : null}

      {hasAccessory("hair") && config.hairImage && selectedHairStyle ? (
        <div
          className="absolute z-[5]"
          style={{
            left: selectedHairStyle.left,
            top: selectedHairStyle.top,
            width: selectedHairStyle.width,
            transform: selectedHairStyle.rotate
              ? `rotate(${selectedHairStyle.rotate})`
              : undefined,
          }}
        >
          <div className="relative aspect-[1.2/1] w-full">
            <img
              src={config.hairImage}
              alt="Hair wig accessory"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : null}

      {hasAccessory("sunglasses") && config.sunglassesImage && selectedSunglassesStyle ? (
        <div
          className="absolute z-10"
          style={{
            left: selectedSunglassesStyle.left,
            top: selectedSunglassesStyle.top,
            width: selectedSunglassesStyle.width,
            transform:
              [
                selectedSunglassesStyle.rotate
                  ? `rotate(${selectedSunglassesStyle.rotate})`
                  : "",
                selectedSunglassesStyle.scaleY
                  ? `scaleY(${selectedSunglassesStyle.scaleY})`
                  : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
            transformOrigin: "center center",
          }}
        >
          <div className="relative aspect-[2.2/1] w-full">
            <img
              src={config.sunglassesImage}
              alt="Sunglasses accessory"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : null}

      {hasAccessory("ornament") && config.accessoryTopImage && selectedTopAccessoryStyle ? (
        <div
          className="absolute z-20"
          style={{
            left: selectedTopAccessoryStyle.left,
            top: selectedTopAccessoryStyle.top,
            width: selectedTopAccessoryStyle.width,
            transform: selectedTopAccessoryStyle.rotate
              ? `rotate(${selectedTopAccessoryStyle.rotate})`
              : undefined,
          }}
        >
          <div className="relative aspect-square w-full">
            <img
              src={config.accessoryTopImage}
              alt="Accessory ornament"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : null}

      {hasAccessory("ornament") && config.accessoryBottomImage && selectedBottomAccessoryStyle ? (
        <div
          className="absolute z-20"
          style={{
            left: selectedBottomAccessoryStyle.left,
            top: selectedBottomAccessoryStyle.top,
            width: selectedBottomAccessoryStyle.width,
            transform: selectedBottomAccessoryStyle.rotate
              ? `rotate(${selectedBottomAccessoryStyle.rotate})`
              : undefined,
          }}
        >
          <div className="relative aspect-square w-full">
            <img
              src={config.accessoryBottomImage}
              alt="Accessory ornament"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>
      ) : null}

      {hasAccessory("flower") ? (
        <div className="absolute right-[12%] top-[10%] h-8 w-8">
          <span
            className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: "#ffd56f" }}
          />
          {["0%", "50%", "100%", "150%", "200%"].map((rotation) => (
            <span
              key={rotation}
              className="absolute left-1/2 top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-[125%] rounded-full"
              style={{
                backgroundColor: config.colors?.flower ?? "#ff9bb8",
                transform: `translate(-50%, -125%) rotate(${rotation})`,
                transformOrigin: "center 18px",
              }}
            />
          ))}
        </div>
      ) : null}

      {hasAccessory("ribbon") ? (
        <div className="absolute left-[8%] top-[20%] flex items-center">
          <span
            className="block h-4 w-4 rotate-12 rounded-sm"
            style={{ backgroundColor: config.colors?.ribbon ?? "#90c9ff" }}
          />
          <span
            className="-ml-1 block h-3 w-3 -rotate-12 rounded-sm"
            style={{ backgroundColor: config.colors?.ribbon ?? "#90c9ff" }}
          />
        </div>
      ) : null}

      {hasAccessory("nameLabel") ? (
        <div
          className="absolute -bottom-[25px] left-1/2 inline-flex min-w-fit max-w-[140%] -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-[rgba(95,54,34,0.18)] px-3 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-[var(--cocoa-deep)] shadow-sm"
          style={{ backgroundColor: config.colors?.label ?? fallbackLabelColor }}
        >
          {config.label ?? "Friend"}
        </div>
      ) : null}
    </div>
  );
}
