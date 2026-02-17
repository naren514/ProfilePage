"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { type Story } from "@/lib/db/schema";

interface StoryFormData {
  title: string;
  slug: string;
  summary: string;
  content: string;
  date: string;
  tags: string[];
  isPublished: boolean;
}

const initialFormData: StoryFormData = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  date: "",
  tags: [],
  isPublished: false,
};

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-2 border rounded-md p-2 bg-muted/30">
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const url = window.prompt("Enter link URL");
          if (!url) return;
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          const url = window.prompt("Enter image URL");
          if (!url) return;
          editor.chain().focus().setImage({ src: url }).run();
        }}
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function StoriesAdminPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [formData, setFormData] = useState<StoryFormData>(initialFormData);
  const [newTag, setNewTag] = useState("");
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Write your post..." }),
    ],
    content: formData.content,
    editorProps: {
      attributes: {
        class: "min-h-[280px] rounded-md border p-4 focus:outline-none bg-background",
      },
    },
    onUpdate: ({ editor }) => {
      setFormData((prev) => ({ ...prev, content: editor.getHTML() }));
    },
  });

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (editor && editor.getHTML() !== formData.content) {
      editor.commands.setContent(formData.content || "<p></p>", { emitUpdate: false });
    }
  }, [editor, formData.content]);

  const fetchStories = async () => {
    try {
      const response = await fetch("/api/admin/stories");
      if (response.ok) {
        const data = await response.json();
        setStories(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const visibleStories = useMemo(
    () => stories.filter((s) => (showDraftsOnly ? !s.isPublished : true)),
    [stories, showDraftsOnly]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingStory ? `/api/admin/stories/${editingStory.id}` : "/api/admin/stories";
      const method = editingStory ? "PUT" : "POST";

      const payload = {
        title: formData.title,
        slug: formData.slug,
        summary: formData.summary,
        action: formData.content,
        situation: "",
        task: "",
        result: "",
        lessonsLearned: "",
        company: "",
        role: "",
        date: formData.date || null,
        tags: formData.tags.filter(Boolean),
        isFeatured: false,
        isPublished: formData.isPublished,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save post");

      toast.success(editingStory ? "Post updated" : "Post created");
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingStory(null);
      editor?.commands.setContent("<p></p>");
      fetchStories();
    } catch {
      toast.error("Failed to save post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (story: Story) => {
    setEditingStory(story);
    setFormData({
      title: story.title,
      slug: story.slug,
      summary: story.summary,
      content: story.action || "",
      date: story.date || "",
      tags: story.tags || [],
      isPublished: story.isPublished,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const response = await fetch(`/api/admin/stories/${id}`, { method: "DELETE" });
    if (response.ok) {
      toast.success("Post deleted");
      fetchStories();
    } else {
      toast.error("Failed to delete post");
    }
  };

  const addTag = () => {
    if (!newTag.trim() || formData.tags.includes(newTag.trim())) return;
    setFormData((p) => ({ ...p, tags: [...p.tags, newTag.trim()] }));
    setNewTag("");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thoughts</h1>
          <p className="text-muted-foreground">A blog-style writing space with drafts and rich text posts.</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingStory(null);
              setFormData(initialFormData);
              editor?.commands.setContent("<p></p>");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStory ? "Edit Post" : "Add New Post"}</DialogTitle>
              <DialogDescription>Write with rich text, embed images, and save as draft or publish.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, title: e.target.value, slug: generateSlug(e.target.value) }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={formData.slug} onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Excerpt</Label>
                <Input
                  value={formData.summary}
                  onChange={(e) => setFormData((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="One-line summary shown on Thoughts index"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Post Body</Label>
                <Toolbar editor={editor} />
                <EditorContent editor={editor} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-3 h-10 px-3 border rounded-md">
                    <Switch
                      checked={formData.isPublished}
                      onCheckedChange={(checked) => setFormData((p) => ({ ...p, isPublished: checked }))}
                    />
                    <span className="text-sm">{formData.isPublished ? "Published" : "Draft"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingStory ? "Update Post" : formData.isPublished ? "Publish Post" : "Save Draft"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={showDraftsOnly} onCheckedChange={setShowDraftsOnly} />
        <span className="text-sm text-muted-foreground">Show drafts only</span>
      </div>

      <Card className="bg-card/50 border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : visibleStories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStories.map((story) => (
                  <TableRow key={story.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{story.title}</p>
                        <p className="text-xs text-muted-foreground">/{story.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={story.isPublished ? "default" : "secondary"}>
                        {story.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>{story.date || "-"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(story)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(story.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No posts yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
