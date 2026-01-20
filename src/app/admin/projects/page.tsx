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
import { Plus, Pencil, Trash2, Loader2, Wand2, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { type Project } from "@/lib/db/schema";
import { AIAssistDialog } from "@/components/admin/ai-assist-dialog";

interface ProjectFormData {
  title: string;
  slug: string;
  summary: string;
  websiteUrl: string;
  thumbnailUrl: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  lessonsLearned: string;
  technologies: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isFeatured: boolean;
  isPublished: boolean;
}

const initialFormData: ProjectFormData = {
  title: "",
  slug: "",
  summary: "",
  websiteUrl: "",
  thumbnailUrl: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  lessonsLearned: "",
  technologies: "",
  company: "",
  role: "",
  startDate: "",
  endDate: "",
  isFeatured: false,
  isPublished: false,
};

interface WebsiteAnalysis {
  title: string;
  summary: string;
  description: string;
  technologies: string[];
  features: string[];
  targetAudience: string;
  category: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
}

interface DetectedTech {
  name: string;
  confidence: number;
  category: string;
}

export default function ProjectsAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [isDetectingTech, setIsDetectingTech] = useState(false);
  const [detectedTech, setDetectedTech] = useState<DetectedTech[]>([]);
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [websiteAnalysis, setWebsiteAnalysis] = useState<WebsiteAnalysis | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/admin/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
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
      const url = editingProject
        ? `/api/admin/projects/${editingProject.id}`
        : "/api/admin/projects";
      const method = editingProject ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          technologies: formData.technologies.split(",").map((t) => t.trim()).filter(Boolean),
          websiteUrl: formData.websiteUrl || null,
          thumbnailUrl: formData.thumbnailUrl || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to save project");

      toast.success(editingProject ? "Project updated" : "Project created");
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingProject(null);
      setDetectedTech([]);
      setWebsiteAnalysis(null);
      fetchProjects();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      slug: project.slug,
      summary: project.summary,
      websiteUrl: project.websiteUrl || "",
      thumbnailUrl: project.thumbnailUrl || "",
      situation: project.situation || "",
      task: project.task || "",
      action: project.action || "",
      result: project.result || "",
      lessonsLearned: project.lessonsLearned || "",
      technologies: project.technologies.join(", "),
      company: project.company || "",
      role: project.role || "",
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      isFeatured: project.isFeatured,
      isPublished: project.isPublished,
    });
    setDetectedTech([]);
    setWebsiteAnalysis(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(`/api/admin/projects/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Project deleted");
      fetchProjects();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete project");
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const detectTechnologies = async () => {
    const description = `${formData.summary} ${formData.situation} ${formData.task} ${formData.action} ${formData.result}`;
    if (description.trim().length < 20) {
      toast.error("Please add more project details first");
      return;
    }

    setIsDetectingTech(true);
    try {
      const response = await fetch("/api/admin/detect-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) throw new Error("Failed to detect technologies");

      const data = await response.json();
      setDetectedTech(data.technologies || []);
    } catch {
      toast.error("Failed to detect technologies");
    } finally {
      setIsDetectingTech(false);
    }
  };

  const analyzeWebsite = async () => {
    if (!formData.websiteUrl.trim()) {
      toast.error("Please enter a website URL first");
      return;
    }

    // Validate URL
    try {
      new URL(formData.websiteUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsAnalyzingWebsite(true);
    setWebsiteAnalysis(null);

    try {
      const response = await fetch("/api/admin/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formData.websiteUrl }),
      });

      if (!response.ok) throw new Error("Failed to analyze website");

      const analysis: WebsiteAnalysis = await response.json();
      setWebsiteAnalysis(analysis);

      // Auto-populate form fields if empty
      if (!formData.title && analysis.title) {
        setFormData((prev) => ({
          ...prev,
          title: analysis.title,
          slug: generateSlug(analysis.title),
        }));
      }
      if (!formData.summary && analysis.summary) {
        setFormData((prev) => ({ ...prev, summary: analysis.summary }));
      }
      if (!formData.technologies && analysis.technologies?.length) {
        setFormData((prev) => ({
          ...prev,
          technologies: analysis.technologies.join(", "),
        }));
      }
      if (analysis.thumbnailUrl) {
        setFormData((prev) => ({ ...prev, thumbnailUrl: analysis.thumbnailUrl || "" }));
      }

      toast.success("Website analyzed successfully");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze website");
    } finally {
      setIsAnalyzingWebsite(false);
    }
  };

  const applyAnalysisField = (field: keyof ProjectFormData, value: string) => {
    if (field === "title") {
      setFormData((prev) => ({
        ...prev,
        title: value,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const addDetectedTech = (tech: DetectedTech) => {
    const currentTechs = formData.technologies
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!currentTechs.includes(tech.name)) {
      const newTechs = [...currentTechs, tech.name].join(", ");
      setFormData({ ...formData, technologies: newTechs });
    }

    setDetectedTech(detectedTech.filter((t) => t.name !== tech.name));
  };

  const updateSTARField = (
    field: "situation" | "task" | "action" | "result" | "lessonsLearned",
    value: string
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your portfolio projects
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingProject(null);
            setFormData(initialFormData);
            setDetectedTech([]);
            setWebsiteAnalysis(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? "Edit Project" : "Add New Project"}
              </DialogTitle>
              <DialogDescription>
                Fill in the project details using the STAR format. Use AI assist for each field.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Website URL and Analysis */}
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website URL
                  </Label>
                  {formData.websiteUrl && (
                    <a
                      href={formData.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://example.com"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={analyzeWebsite}
                    disabled={isAnalyzingWebsite || !formData.websiteUrl.trim()}
                  >
                    {isAnalyzingWebsite ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Analyze
                  </Button>
                </div>

                {/* Thumbnail Preview */}
                {formData.thumbnailUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Thumbnail Preview</p>
                    <div className="relative w-48 h-32 border rounded overflow-hidden bg-background">
                      <img
                        src={formData.thumbnailUrl}
                        alt="Website thumbnail"
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                {websiteAnalysis && (
                  <div className="mt-4 space-y-3 p-3 bg-background rounded border">
                    <p className="text-sm font-medium">Analysis Results</p>

                    {websiteAnalysis.title && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Title:</span>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{websiteAnalysis.title}</span>
                          {formData.title !== websiteAnalysis.title && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => applyAnalysisField("title", websiteAnalysis.title)}
                              className="h-6 text-xs"
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {websiteAnalysis.summary && (
                      <div className="text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground">Summary:</span>
                          {formData.summary !== websiteAnalysis.summary && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => applyAnalysisField("summary", websiteAnalysis.summary)}
                              className="h-6 text-xs"
                            >
                              Apply
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{websiteAnalysis.summary}</p>
                      </div>
                    )}

                    {websiteAnalysis.description && (
                      <div className="text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground">Description:</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => applyAnalysisField("situation", websiteAnalysis.description)}
                            className="h-6 text-xs"
                          >
                            Use as Situation
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">{websiteAnalysis.description}</p>
                      </div>
                    )}

                    {websiteAnalysis.technologies?.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Technologies:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {websiteAnalysis.technologies.map((tech) => (
                            <Badge key={tech} variant="outline" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {websiteAnalysis.category && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Category:</span>
                        <span>{websiteAnalysis.category}</span>
                      </div>
                    )}

                    {websiteAnalysis.features?.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Features:</span>
                        <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                          {websiteAnalysis.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="truncate">{feature}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="technologies">Technologies (comma-separated)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={detectTechnologies}
                    disabled={isDetectingTech}
                  >
                    {isDetectingTech ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Auto-detect
                  </Button>
                </div>
                <Input
                  id="technologies"
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                  placeholder="AWS, Terraform, Kubernetes, Python"
                />
                {detectedTech.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {detectedTech.map((tech) => (
                      <Badge
                        key={tech.name}
                        variant="outline"
                        className="cursor-pointer hover:bg-secondary"
                        onClick={() => addDetectedTech(tech)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {tech.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Math.round(tech.confidence * 100)}%)
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <h3 className="font-semibold">STAR Format</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional for personal projects. Fill in relevant sections as needed.
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
                    onChange={(e) => setFormData({ ...formData, situation: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, task: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, result: e.target.value })}
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
                      onApply={(content) => updateSTARField("lessonsLearned", content)}
                    />
                  </div>
                  <Textarea
                    id="lessonsLearned"
                    value={formData.lessonsLearned}
                    onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
                    rows={3}
                    placeholder="What did you learn from this project?"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                  />
                  <Label htmlFor="isFeatured">Featured</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublished"
                    checked={formData.isPublished}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                  />
                  <Label htmlFor="isPublished">Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProject ? "Update" : "Create"}
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
          ) : projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Technologies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.title}</p>
                        <p className="text-xs text-muted-foreground">/{project.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>{project.company || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.slice(0, 3).map((tech) => (
                          <Badge key={tech} variant="secondary" className="text-xs">
                            {tech}
                          </Badge>
                        ))}
                        {project.technologies.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{project.technologies.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {project.isFeatured && (
                          <Badge variant="default" className="text-xs">Featured</Badge>
                        )}
                        <Badge variant={project.isPublished ? "secondary" : "outline"} className="text-xs">
                          {project.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(project.id)}
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
              <p className="text-muted-foreground">No projects yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
