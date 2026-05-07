import { dirname, isAbsolute } from "node:path";

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

  const selectedPath = paths.find((path) => path.trim().length > 0);
  return selectedPath ?? null;
}

function getStartingFolder(currentPath?: string) {
  if (currentPath && isAbsolute(currentPath)) return dirname(currentPath);
  return "~";
}
