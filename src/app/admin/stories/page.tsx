"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { type Story } from "@/lib/db/schema";
import { AIAssistDialog } from "@/components/admin/ai-assist-dialog";
import { StoryImport } from "@/components/admin/story-import";

interface StoryFormData {
  title: string;
  slug: string;
  summary: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  lessonsLearned: string;
  company: string;
  role: string;
  date: string;
  tags: string[];
  isFeatured: boolean;
  isPublished: boolean;
}

const initialFormData: StoryFormData = {
  title: "",
  slug: "",
  summary: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  lessonsLearned: "",
  company: "",
  role: "",
  date: "",
  tags: [],
  isFeatured: false,
  isPublished: false,
};

export default function StoriesAdminPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [formData, setFormData] = useState<StoryFormData>(initialFormData);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const response = await fetch("/api/admin/stories");
      if (response.ok) {
        const data = await response.json();
        setStories(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingStory
        ? `/api/admin/stories/${editingStory.id}`
        : "/api/admin/stories";
      const method = editingStory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.filter(Boolean),
        }),
      });

      if (!response.ok) throw new Error("Failed to save story");

      toast.success(editingStory ? "Story updated" : "Story created");
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingStory(null);
      fetchStories();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save story");
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
      situation: story.situation || "",
      task: story.task || "",
      action: story.action || "",
      result: story.result || "",
      lessonsLearned: story.lessonsLearned || "",
      company: story.company || "",
      role: story.role || "",
      date: story.date || "",
      tags: story.tags || [],
      isFeatured: story.isFeatured,
      isPublished: story.isPublished,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this story?")) return;

    try {
      const response = await fetch(`/api/admin/stories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Story deleted");
      fetchStories();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete story");
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const updateSTARField = (
    field: "situation" | "task" | "action" | "result" | "lessonsLearned",
    value: string
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleStoryImport = (data: {
    title: string;
    summary: string;
    company: string;
    role: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    lessonsLearned: string;
    tags: string[];
  }) => {
    setFormData({
      ...formData,
      title: data.title || formData.title,
      slug: generateSlug(data.title || formData.title),
      summary: data.summary || formData.summary,
      company: data.company || formData.company,
      role: data.role || formData.role,
      situation: data.situation || formData.situation,
      task: data.task || formData.task,
      action: data.action || formData.action,
      result: data.result || formData.result,
      lessonsLearned: data.lessonsLearned || formData.lessonsLearned,
      tags: data.tags?.length > 0 ? data.tags : formData.tags,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stories</h1>
          <p className="text-muted-foreground">
            Manage your work-related stories using STAR format
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingStory(null);
              setFormData(initialFormData);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Story
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle>
                    {editingStory ? "Edit Story" : "Add New Story"}
                  </DialogTitle>
                  <DialogDescription>
                    Share your work experiences using the STAR format.
                  </DialogDescription>
                </div>
                {!editingStory && (
                  <StoryImport onImport={handleStoryImport} />
                )}
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        title: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) =>
                    setFormData({ ...formData, summary: e.target.value })
                  }
                  rows={2}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>
                    Add
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h3 className="font-semibold">STAR Format</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional fields. Fill in relevant sections as needed.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="situation">Situation</Label>
                    <AIAssistDialog
                      targetField="situation"
                      currentValue={formData.situation}
                      onApply={(content) => updateSTARField("situation", content)}
                    />
                  </div>
                  <Textarea
                    id="situation"
                    value={formData.situation}
                    onChange={(e) =>
                      setFormData({ ...formData, situation: e.target.value })
                    }
                    rows={3}
                    placeholder="What was the context or background?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task">Task</Label>
                    <AIAssistDialog
                      targetField="task"
                      currentValue={formData.task}
                      onApply={(content) => updateSTARField("task", content)}
                    />
                  </div>
                  <Textarea
                    id="task"
                    value={formData.task}
                    onChange={(e) =>
                      setFormData({ ...formData, task: e.target.value })
                    }
                    rows={3}
                    placeholder="What was your objective or goal?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="action">Action</Label>
                    <AIAssistDialog
                      targetField="action"
                      currentValue={formData.action}
                      onApply={(content) => updateSTARField("action", content)}
                    />
                  </div>
                  <Textarea
                    id="action"
                    value={formData.action}
                    onChange={(e) =>
                      setFormData({ ...formData, action: e.target.value })
                    }
                    rows={3}
                    placeholder="What did you do to achieve the goal?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="result">Result</Label>
                    <AIAssistDialog
                      targetField="result"
                      currentValue={formData.result}
                      onApply={(content) => updateSTARField("result", content)}
                    />
                  </div>
                  <Textarea
                    id="result"
                    value={formData.result}
                    onChange={(e) =>
                      setFormData({ ...formData, result: e.target.value })
                    }
                    rows={3}
                    placeholder="What was the outcome or impact?"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lessonsLearned">Lessons Learned</Label>
                    <AIAssistDialog
                      targetField="lessonsLearned"
                      currentValue={formData.lessonsLearned}
                      onApply={(content) =>
                        updateSTARField("lessonsLearned", content)
                      }
                    />
                  </div>
                  <Textarea
                    id="lessonsLearned"
                    value={formData.lessonsLearned}
                    onChange={(e) =>
                      setFormData({ ...formData, lessonsLearned: e.target.value })
                    }
                    rows={3}
                    placeholder="What did you learn from this experience?"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isFeatured: checked })
                    }
                  />
                  <Label htmlFor="isFeatured">Featured</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublished"
                    checked={formData.isPublished}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isPublished: checked })
                    }
                  />
                  <Label htmlFor="isPublished">Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingStory ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card/50 border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : stories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stories.map((story) => (
                  <TableRow key={story.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{story.title}</p>
                        <p className="text-xs text-muted-foreground">
                          /{story.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{story.company || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(story.tags || []).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(story.tags || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(story.tags || []).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {story.isFeatured && (
                          <Badge variant="default" className="text-xs">
                            Featured
                          </Badge>
                        )}
                        <Badge
                          variant={story.isPublished ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {story.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(story)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(story.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No stories yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
