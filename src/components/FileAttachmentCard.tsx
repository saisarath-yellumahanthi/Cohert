import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Image as ImageIcon,
  Download,
  ExternalLink,
} from 'lucide-react';
import { FileAttachment } from '../types';
import { formatFileSize, getFileExtension, isImageAttachment } from '../utils/validation';

interface FileAttachmentCardProps {
  attachment: FileAttachment;
  isMine?: boolean;
  compact?: boolean;
}

export const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({
  attachment,
  isMine = false,
  compact = false,
}) => {
  const ext = (attachment.extension || getFileExtension(attachment.name)).toLowerCase();
  const isPdf = ext === 'pdf' || attachment.type === 'application/pdf';
  const isImage = isImageAttachment(attachment.name, attachment.type);

  const renderIcon = () => {
    if (isImage) {
      return <ImageIcon className="w-5 h-5" />;
    }
    if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
      return <FileSpreadsheet className="w-5 h-5" />;
    }
    if (ext === 'zip') {
      return <FileArchive className="w-5 h-5" />;
    }
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx' || ext === 'ppt' || ext === 'pptx' || ext === 'txt') {
      return <FileText className="w-5 h-5" />;
    }
    return <FileIcon className="w-5 h-5" />;
  };

  if (isImage && !compact) {
    return (
      <div className="space-y-1.5">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl overflow-hidden border border-[#DBDBDB]/60 dark:border-[#262626]"
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-60 w-full object-cover"
          />
        </a>
        <div
          className={`flex items-center justify-between gap-2 text-[11px] px-1 ${
            isMine ? 'text-white/90' : 'text-[#8E8E8E] dark:text-[#A8A8A8]'
          }`}
        >
          <span className="truncate font-medium">{attachment.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span>{formatFileSize(attachment.size)}</span>
            <a
              href={attachment.url}
              download={attachment.name}
              target="_blank"
              rel="noopener noreferrer"
              title="Download image"
              className="hover:opacity-80 underline font-semibold"
            >
              Download
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
        isMine
          ? 'bg-white/15 border-white/25 text-white'
          : 'bg-[#FAFAFA] dark:bg-[#1E1E1E] border-[#DBDBDB] dark:border-[#262626] text-[#262626] dark:text-[#F5F5F5]'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${
          isMine
            ? 'bg-white/20 text-white'
            : 'bg-cohert-gradient/10 text-[#E1306C]'
        }`}
      >
        {renderIcon()}
        <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">
          {ext || 'FILE'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-semibold truncate ${
            isMine ? 'text-white' : 'text-[#262626] dark:text-[#F5F5F5]'
          }`}
          title={attachment.name}
        >
          {attachment.name}
        </p>
        <p
          className={`text-[11px] mt-0.5 ${
            isMine ? 'text-white/80' : 'text-[#8E8E8E] dark:text-[#A8A8A8]'
          }`}
        >
          {ext ? `${ext.toUpperCase()} • ` : ''}
          {formatFileSize(attachment.size)}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isPdf && (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open PDF in new tab"
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-80 ${
              isMine
                ? 'bg-white text-[#E1306C]'
                : 'bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-[#F5F5F5]'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span>
          </a>
        )}
        <a
          href={attachment.url}
          download={attachment.name}
          target="_blank"
          rel="noopener noreferrer"
          title={isPdf ? 'Download file' : 'Open or download file'}
          className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-80 ${
            isMine
              ? 'bg-white/20 text-white'
              : 'bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-[#F5F5F5]'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          {!isPdf && <span className="hidden sm:inline">Download</span>}
        </a>
      </div>
    </div>
  );
};
