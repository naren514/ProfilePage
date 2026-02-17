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
import { Plus, Pencil, Trash2, Loader2, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { type Certification } from "@/lib/db/schema";

interface CertificationFormData {
  name: string;
  issuer: string;
  credentialId: string;
  credentialUrl: string;
  issueDate: string;
  expirationDate: string;
  badgeUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const initialFormData: CertificationFormData = {
  name: "",
  issuer: "",
  credentialId: "",
  credentialUrl: "",
  issueDate: "",
  expirationDate: "",
  badgeUrl: "",
  isActive: true,
  sortOrder: 0,
};

export default function CertificationsAdminPage() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCertification, setEditingCertification] = useState<Certification | null>(null);
  const [formData, setFormData] = useState<CertificationFormData>(initialFormData);

  useEffect(() => {
    fetchCertifications();
  }, []);

  const fetchCertifications = async () => {
    try {
      const response = await fetch("/api/admin/certifications");
      if (response.ok) {
        const data = await response.json();
        setCertifications(data);
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
      const url = editingCertification
        ? `/api/admin/certifications/${editingCertification.id}`
        : "/api/admin/certifications";
      const method = editingCertification ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save certification");

      toast.success(editingCertification ? "Certification updated" : "Certification created");
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingCertification(null);
      fetchCertifications();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save certification");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (cert: Certification) => {
    setEditingCertification(cert);
    setFormData({
      name: cert.name,
      issuer: cert.issuer,
      credentialId: cert.credentialId || "",
      credentialUrl: cert.credentialUrl || "",
      issueDate: cert.issueDate,
      expirationDate: cert.expirationDate || "",
      badgeUrl: cert.badgeUrl || "",
      isActive: cert.isActive,
      sortOrder: cert.sortOrder || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this certification?")) return;

    try {
      const response = await fetch(`/api/admin/certifications/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Certification deleted");
      fetchCertifications();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete certification");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-2"><BookOpen className="h-7 w-7" />Reading List</h1>
          <p className="text-muted-foreground">
            Manage interesting articles, links, and excerpts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCertification(null);
            setFormData(initialFormData);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCertification ? "Edit Article" : "Add New Article"}
              </DialogTitle>
              <DialogDescription>
                Save article metadata and your excerpt/notes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Article Title</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="How to Build Reliable Systems"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issuer">Source / Publication</Label>
                  <Input
                    id="issuer"
                    value={formData.issuer}
                    onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                    placeholder="Stripe Engineering Blog"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="credentialId">Excerpt / Notes</Label>
                  <Textarea
                    id="credentialId"
                    value={formData.credentialId}
                    onChange={(e) => setFormData({ ...formData, credentialId: e.target.value })}
                    placeholder="Key idea from the article..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credentialUrl">Article URL</Label>
                  <Input
                    id="credentialUrl"
                    type="url"
                    value={formData.credentialUrl}
                    onChange={(e) => setFormData({ ...formData, credentialUrl: e.target.value })}
                    placeholder="https://verify.example.com/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Published / Read Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expirationDate">Optional Follow-up Date</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="badgeUrl">Cover Image URL (optional)</Label>
                <Input
                  id="badgeUrl"
                  type="url"
                  value={formData.badgeUrl}
                  onChange={(e) => setFormData({ ...formData, badgeUrl: e.target.value })}
                  placeholder="https://example.com/badge.png"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCertification ? "Update" : "Create"}
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
          ) : certifications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Excerpt</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certifications.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cert.name}</p>
                        <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{formatDate(cert.issueDate)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cert.credentialId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-clamp-2">{cert.credentialId}</span>
                          {cert.credentialUrl && (
                            <a
                              href={cert.credentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {cert.isActive ? (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cert)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(cert.id)}
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
              <p className="text-muted-foreground">No reading list items yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
