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
import { type VolunteerWork } from "@/lib/db/schema";
import { AIAssistDialog } from "@/components/admin/ai-assist-dialog";

interface VolunteerFormData {
  organization: string;
  role: string;
  location: string;
  cause: string;
  description: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  skills: string[];
  websiteUrl: string;
  isPublished: boolean;
}

const initialFormData: VolunteerFormData = {
  organization: "",
  role: "",
  location: "",
  cause: "",
  description: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  skills: [],
  websiteUrl: "",
  isPublished: false,
};

export default function VolunteerAdminPage() {
  const [volunteerList, setVolunteerList] = useState<VolunteerWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerWork | null>(null);
  const [formData, setFormData] = useState<VolunteerFormData>(initialFormData);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    fetchVolunteerWork();
  }, []);

  const fetchVolunteerWork = async () => {
    try {
      const response = await fetch("/api/admin/volunteer");
      if (response.ok) {
        const data = await response.json();
        setVolunteerList(data);
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
      const url = editingVolunteer
        ? `/api/admin/volunteer/${editingVolunteer.id}`
        : "/api/admin/volunteer";
      const method = editingVolunteer ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          skills: formData.skills.filter(Boolean),
        }),
      });

      if (!response.ok) throw new Error("Failed to save volunteer work");

      toast.success(editingVolunteer ? "Volunteer work updated" : "Volunteer work created");
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingVolunteer(null);
      fetchVolunteerWork();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save volunteer work");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (volunteer: VolunteerWork) => {
    setEditingVolunteer(volunteer);
    setFormData({
      organization: volunteer.organization,
      role: volunteer.role,
      location: volunteer.location || "",
      cause: volunteer.cause || "",
      description: volunteer.description || "",
      situation: volunteer.situation || "",
      task: volunteer.task || "",
      action: volunteer.action || "",
      result: volunteer.result || "",
      startDate: volunteer.startDate || "",
      endDate: volunteer.endDate || "",
      isCurrent: volunteer.isCurrent,
      skills: volunteer.skills || [],
      websiteUrl: volunteer.websiteUrl || "",
      isPublished: volunteer.isPublished,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this volunteer work?")) return;

    try {
      const response = await fetch(`/api/admin/volunteer/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Volunteer work deleted");
      fetchVolunteerWork();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete volunteer work");
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((skill) => skill !== skillToRemove),
    });
  };

  const updateSTARField = (
    field: "situation" | "task" | "action" | "result",
    value: string
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thoughts</h1>
          <p className="text-muted-foreground">
            Manage your volunteer experiences
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingVolunteer(null);
              setFormData(initialFormData);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Thoughts
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVolunteer ? "Edit Thoughts" : "Add New Thoughts"}
              </DialogTitle>
              <DialogDescription>
                Document your volunteer experiences.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization</Label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) =>
                      setFormData({ ...formData, organization: e.target.value })
                    }
                    required
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
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="City, State/Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cause">Cause</Label>
                  <Input
                    id="cause"
                    value={formData.cause}
                    onChange={(e) =>
                      setFormData({ ...formData, cause: e.target.value })
                    }
                    placeholder="e.g., Education, Environment"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Brief overview of your volunteer work"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    disabled={formData.isCurrent}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isCurrent"
                  checked={formData.isCurrent}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isCurrent: checked, endDate: checked ? "" : formData.endDate })
                  }
                />
                <Label htmlFor="isCurrent">Currently volunteering here</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Organization Website</Label>
                <Input
                  id="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, websiteUrl: e.target.value })
                  }
                  placeholder="https://organization.org"
                />
              </div>

              <div className="space-y-2">
                <Label>Skills Applied</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addSkill}>
                    Add
                  </Button>
                </div>
                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
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
                  <h3 className="font-semibold">STAR Format (Optional)</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Document a specific achievement or impact from this role.
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
                    rows={2}
                    placeholder="What challenge or opportunity did you address?"
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
                    rows={2}
                    placeholder="What was your specific responsibility?"
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
                    rows={2}
                    placeholder="What steps did you take?"
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
                    rows={2}
                    placeholder="What was the outcome or impact?"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="isPublished"
                  checked={formData.isPublished}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isPublished: checked })
                  }
                />
                <Label htmlFor="isPublished">Published</Label>
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
                  {editingVolunteer ? "Update" : "Create"}
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
          ) : volunteerList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Cause</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteerList.map((volunteer) => (
                  <TableRow key={volunteer.id}>
                    <TableCell>
                      <p className="font-medium">{volunteer.role}</p>
                    </TableCell>
                    <TableCell>{volunteer.organization}</TableCell>
                    <TableCell>{volunteer.cause || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {volunteer.startDate || "N/A"} -{" "}
                        {volunteer.isCurrent ? "Present" : volunteer.endDate || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {volunteer.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                        <Badge
                          variant={volunteer.isPublished ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {volunteer.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(volunteer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(volunteer.id)}
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
              <p className="text-muted-foreground">No volunteer work yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
