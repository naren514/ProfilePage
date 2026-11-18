"use client";

import { useRef } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

export function EditorToolbar({
  editor,
  onUploadImage,
  uploading,
}: {
  editor: Editor;
  onUploadImage: (file: File) => void;
  uploading: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const editLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove the link)", previous ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") {
      chain().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https?:|mailto:)/i.test(url.trim())) {
      window.alert("Links must start with https://, http:// or mailto:");
      return;
    }
    chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      <ToolButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolButton>
      <Divider />
      <ToolButton label="Heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Subheading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolButton>
      <Divider />
      <ToolButton label="Link" active={state.link} onClick={editLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Insert image" disabled={uploading} onClick={() => fileInput.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </ToolButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUploadImage(file);
        }}
      />
      <Divider />
      <ToolButton label="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}
