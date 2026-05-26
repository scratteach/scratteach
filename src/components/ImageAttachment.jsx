import React, { useRef } from 'react';

const AttachIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15.5 8.5l-7 7a4.5 4.5 0 0 1-6.364-6.364l7-7a3 3 0 0 1 4.243 4.243l-7.072 7.07A1.5 1.5 0 0 1 4.06 11.94l6.364-6.364"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MAX_SIZE_MB = 5;

const ImageAttachment = ({ imageData, onImageSelect, onImageRemove, accentClass = 'text-orange-500 hover:bg-orange-50' }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('JPEG、PNG、GIF、WebP形式の画像のみ添付できます。');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`画像サイズは${MAX_SIZE_MB}MB以下にしてください。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(',')[1];
      onImageSelect({
        mimeType: file.type,
        data: base64,
        preview: dataUrl,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="画像を選択"
      />

      {imageData ? (
        <div className="relative inline-block flex-shrink-0">
          <img
            src={imageData.preview}
            alt="添付画像プレビュー"
            className="h-10 w-10 rounded-lg object-cover border border-gray-200"
          />
          <button
            onClick={onImageRemove}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors"
            aria-label="画像を削除"
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${accentClass}`}
          aria-label="画像を添付"
          title="画像を添付"
          type="button"
        >
          <AttachIcon />
        </button>
      )}
    </>
  );
};

export default ImageAttachment;
