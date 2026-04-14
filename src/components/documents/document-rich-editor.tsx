"use client";

import LinkExtension from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type DocumentRichEditorProps = {
  value: string;
  disabled: boolean;
  onChange: (html: string) => void;
  onReady?: (actions: { insertVariable: (variable: string) => void }) => void;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-teal-300 bg-teal-50 text-teal-800"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function DocumentRichEditor({
  value,
  disabled,
  onChange,
  onReady,
}: DocumentRichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[620px] max-w-none rounded-b-lg bg-white px-8 py-8 text-sm leading-7 text-slate-950 outline-none",
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === editor.getHTML()) {
      return;
    }

    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !onReady) {
      return;
    }

    onReady({
      insertVariable(variable: string) {
        editor.chain().focus().insertContent(`{{${variable}}}`).run();
      },
    });
  }, [editor, onReady]);

  function setLink() {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previousUrl ?? "https://");

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const toolbarDisabled = disabled || !editor;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white p-3">
        <ToolbarButton
          label="Desfazer"
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Refazer"
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().redo().run()}
        />
        <ToolbarButton
          label="Negrito"
          active={editor?.isActive("bold")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italico"
          active={editor?.isActive("italic")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Sublinhado"
          active={editor?.isActive("underline")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="H1"
          active={editor?.isActive("heading", { level: 1 })}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          active={editor?.isActive("heading", { level: 2 })}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="Lista"
          active={editor?.isActive("bulletList")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numerada"
          active={editor?.isActive("orderedList")}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Esq."
          active={editor?.isActive({ textAlign: "left" })}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarButton
          label="Centro"
          active={editor?.isActive({ textAlign: "center" })}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarButton
          label="Dir."
          active={editor?.isActive({ textAlign: "right" })}
          disabled={toolbarDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        />
        <ToolbarButton
          label="Link"
          active={editor?.isActive("link")}
          disabled={toolbarDisabled}
          onClick={setLink}
        />
        <ToolbarButton
          label="Tabela"
          disabled={toolbarDisabled}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
