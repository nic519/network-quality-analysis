import { dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBinaryInput } from "./runner";

type OpenFileDialogOptions = {
  startingFolder?: string;
  allowedFileTypes?: string;
  canChooseFiles?: boolean;
  canChooseDirectory?: boolean;
  allowsMultipleSelection?: boolean;
};

type ChooseConfigFileOptions = {
  currentPath?: string;
  openFileDialog: (options: OpenFileDialogOptions) => Promise<string[]>;
};

type ChooseExportDirectoryOptions = {
  openFileDialog: (options: OpenFileDialogOptions) => Promise<string[]>;
};

type ChooseClashSpeedtestBinaryOptions = {
  currentPath?: string | null;
  openFileDialog: (options: OpenFileDialogOptions) => Promise<string[]>;
};

export async function chooseConfigFile({
  currentPath,
  openFileDialog,
}: ChooseConfigFileOptions) {
  const paths = await openFileDialog({
    startingFolder: getStartingFolder(currentPath),
    allowedFileTypes: "yaml,yml,json",
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
  });

  const selectedPath = paths.map(normalizeSelectedPath).find((path) => path.length > 0);
  return selectedPath ?? null;
}

export async function chooseExportDirectory({ openFileDialog }: ChooseExportDirectoryOptions) {
  const paths = await openFileDialog({
    startingFolder: "~",
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
  });

  const selectedPath = paths.map(normalizeSelectedPath).find((path) => path.length > 0);
  return selectedPath ?? null;
}

export async function chooseClashSpeedtestBinary({
  currentPath,
  openFileDialog,
}: ChooseClashSpeedtestBinaryOptions) {
  const paths = await openFileDialog({
    startingFolder: getStartingFolder(currentPath ?? undefined),
    allowedFileTypes: "",
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
  });

  const selectedPath = paths.map(normalizeSelectedPath).find((path) => path.length > 0);
  if (selectedPath) validateBinaryInput(selectedPath);
  return selectedPath ?? null;
}

function getStartingFolder(currentPath?: string) {
  if (currentPath && isAbsolute(currentPath)) return dirname(currentPath);
  return "~";
}

function normalizeSelectedPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed.startsWith("file://")) return trimmed;
  return fileURLToPath(trimmed);
}
