import { useState, useRef } from "react";
import { Image, Mic, Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, imageBase64?: string, imageMimeType?: string) => void;
  onStartVoice: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStartVoice, isStreaming, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ data: string; mime: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && !preview) return;

    onSend(trimmed, preview?.data, preview?.mime);
    setText("");
    setPreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setPreview({ data: base64, mime: file.type });
    };
    reader.readAsDataURL(file);

    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          setPreview({ data: base64, mime: file.type });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  return (
    <div className="border-t bg-background p-3">
      {preview && (
        <div className="relative inline-block mb-2">
          <img
            src={`data:${preview.mime};base64,${preview.data}`}
            alt="preview"
            className="h-16 w-16 rounded object-cover border"
          />
          <button
            onClick={() => setPreview(null)}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          disabled={disabled}
        >
          <Image size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />

        <button
          onClick={onStartVoice}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          disabled={disabled || isStreaming}
        >
          <Mic size={20} />
        </button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ecrivez votre message..."
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />

        {isStreaming ? (
          <button
            onClick={() => {}}
            className="p-2 rounded-md bg-destructive text-destructive-foreground"
            disabled
          >
            <Square size={20} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={disabled || (!text.trim() && !preview)}
          >
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
