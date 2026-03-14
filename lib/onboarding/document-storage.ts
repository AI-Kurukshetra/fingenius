import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DEFAULT_DOCUMENT_UPLOAD_ROOT = path.join(process.cwd(), "uploads", "customer-documents");

const getDocumentUploadRoot = (): string => {
  return process.env.DOCUMENT_UPLOAD_ROOT?.trim() || DEFAULT_DOCUMENT_UPLOAD_ROOT;
};

const resolveDocumentAbsolutePath = (relativePath: string): string => {
  const uploadRoot = getDocumentUploadRoot();
  const root = path.resolve(uploadRoot);
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const absolutePath = path.resolve(root, normalizedRelativePath);

  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid document storage path");
  }

  return absolutePath;
};

export const writeDocumentFile = async (relativePath: string, file: File): Promise<void> => {
  const absolutePath = resolveDocumentAbsolutePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);
};

export const readDocumentFile = async (relativePath: string): Promise<Buffer> => {
  const absolutePath = resolveDocumentAbsolutePath(relativePath);
  return readFile(absolutePath);
};
