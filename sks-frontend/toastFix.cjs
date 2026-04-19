const fs = require('fs');
let code = fs.readFileSync('src/components/documents/UploadModal.jsx', 'utf8');

// Add import toast at the top
if (!code.includes('import toast from "react-hot-toast";')) {
  code = code.replace(
    /import \{ useEffect, useMemo, useRef, useState \} from "react";/,
    'import { useEffect, useMemo, useRef, useState } from "react";\nimport toast from "react-hot-toast";'
  );
}

// Remove isSuccess state initialization and updates
code = code.replace(/const \[isSuccess, setIsSuccess\] = useState\(false\);\n  /, '');
code = code.replace(/setIsSuccess\(false\);\n    /g, '');

// Fix handleSubmit
const oldHandleSubmit = `    try {
      await onUploadSuccess(file, title || file.name, selectedFolderId || null);
      setIsUploading(false);
      setIsSuccess(true);
      setTimeout(() => {
        setFile(null);
        setTitle("");
        setSelectedFolderId(defaultFolderId || "");
        setIsSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      setIsUploading(false);
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    }`;

const newHandleSubmit = `    try {
      await onUploadSuccess(file, title || file.name, selectedFolderId || null);
      setFile(null);
      setTitle("");
      setSelectedFolderId(defaultFolderId || "");
      onClose();
      toast.success("Document uploaded & processed successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed. Please try again.");
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }`;

code = code.replace(oldHandleSubmit, newHandleSubmit);

// Revert the title logic
code = code.replace(
  /\{isSuccess \? "Success" : isUploading \? "Integrating Data\.\.\." : "Upload Form"\}/g,
  '{isUploading ? "Integrating Data..." : "Upload Form"}'
);

// Revert to onClose only for disabled
code = code.replace(
  /onClick=\{isUploading \|\| isSuccess \? undefined : onClose\}/g,
  'onClick={isUploading ? undefined : onClose}'
).replace(
  /disabled=\{isUploading \|\| isSuccess\}/g,
  'disabled={isUploading}'
).replace(
  /\(isUploading \|\| isSuccess\)\n\s+\? "opacity-0 scale-90 pointer-events-none"/g,
  'isUploading ? "opacity-0 scale-90 pointer-events-none"'
);

// Revert UI to only toggle on isUploading
const oldUIRegex = /\{isSuccess \? \([\s\S]*?\) : isUploading \? \(\n\s*<div/m;
code = code.replace(oldUIRegex, '{isUploading ? (\n    <div');

fs.writeFileSync('src/components/documents/UploadModal.jsx', code);
console.log("Reverted success and added toast");
