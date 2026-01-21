"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, User, Briefcase, Code2, BarChart } from "lucide-react";
import { toast } from "sonner";

interface SiteSettings {
  hero: {
    name: string;
    title: string;
    location: string;
    subtitle: string;
    stats: Array<{ label: string; value: string }>;
  };
  about: {
    headline: string;
    description: string;
    features: Array<{ name: string; description: string }>;
  };
  skills: Array<{ name: string; skills: string[] }>;
  contact: {
    email: string;
    linkedin: string;
    phone: string;
  };
}

const defaultSettings: SiteSettings = {
  hero: {
    name: "Your Name",
    title: "Your Title",
    location: "City, State",
    subtitle: "A brief description of your professional focus and expertise.",
    stats: [
      { label: "Years Experience", value: "10+" },
      { label: "Projects Completed", value: "50+" },
      { label: "Technologies", value: "20+" },
      { label: "Certifications", value: "5+" },
    ],
  },
  about: {
    headline: "Your Professional Headline",
    description: "A brief description of your background and what you specialize in.",
    features: [
      { name: "Cloud Architecture", description: "Enterprise Support Lead at AWS delivering secure, scalable cloud outcomes." },
      { name: "Security Excellence", description: "Gold status in AWS Security community." },
      { name: "Team Leadership", description: "Mentored and onboarded 12+ Technical Account Managers." },
      { name: "GenAI Innovation", description: "Developed secure GenAI applications increasing productivity by 50%." },
    ],
  },
  skills: [
    { name: "Cloud Platforms", skills: ["AWS", "Azure", "GCP"] },
    { name: "AI & Automation", skills: ["Generative AI", "Agentic AI", "Automation Tools"] },
    { name: "Development", skills: ["Python", "Java", "JavaScript"] },
  ],
  contact: {
    email: "your.email@example.com",
    linkedin: "https://linkedin.com/in/yourprofile",
    phone: "",
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          setSettings({
            hero: data.hero || defaultSettings.hero,
            about: data.about || defaultSettings.about,
            skills: data.skills || defaultSettings.skills,
            contact: data.contact || defaultSettings.contact,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateHero = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
  };

  const updateHeroStat = (index: number, field: "label" | "value", value: string) => {
    setSettings((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        stats: prev.hero.stats.map((stat, i) =>
          i === index ? { ...stat, [field]: value } : stat
        ),
      },
    }));
  };

  const updateAbout = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      about: { ...prev.about, [field]: value },
    }));
  };

  const updateAboutFeature = (index: number, field: "name" | "description", value: string) => {
    setSettings((prev) => ({
      ...prev,
      about: {
        ...prev.about,
        features: prev.about.features.map((f, i) =>
          i === index ? { ...f, [field]: value } : f
        ),
      },
    }));
  };

  const updateSkillCategory = (index: number, field: "name" | "skills", value: string | string[]) => {
    setSettings((prev) => ({
      ...prev,
      skills: prev.skills.map((cat, i) =>
        i === index ? { ...cat, [field]: value } : cat
      ),
    }));
  };

  const updateContact = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Settings</h1>
          <p className="text-muted-foreground">
            Configure content displayed on your portfolio
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All Changes
        </Button>
      </div>

      <Tabs defaultValue="hero" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hero" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Hero
          </TabsTrigger>
          <TabsTrigger value="about" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            About
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Contact
          </TabsTrigger>
        </TabsList>

        {/* Hero Section */}
        <TabsContent value="hero">
          <Card className="bg-card/50 border-border/60">
            <CardHeader>
              <CardTitle>Hero Section</CardTitle>
              <CardDescription>
                Configure the main landing section of your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hero-name">Name</Label>
                  <Input
                    id="hero-name"
                    value={settings.hero.name}
                    onChange={(e) => updateHero("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-title">Title</Label>
                  <Input
                    id="hero-title"
                    value={settings.hero.title}
                    onChange={(e) => updateHero("title", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero-location">Location</Label>
                <Input
                  id="hero-location"
                  value={settings.hero.location}
                  onChange={(e) => updateHero("location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero-subtitle">Subtitle</Label>
                <Textarea
                  id="hero-subtitle"
                  value={settings.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <Label>Stats</Label>
                <div className="grid grid-cols-2 gap-4">
                  {settings.hero.stats.map((stat, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Value"
                        value={stat.value}
                        onChange={(e) => updateHeroStat(index, "value", e.target.value)}
                        className="w-24"
                      />
                      <Input
                        placeholder="Label"
                        value={stat.label}
                        onChange={(e) => updateHeroStat(index, "label", e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Section */}
        <TabsContent value="about">
          <Card className="bg-card/50 border-border/60">
            <CardHeader>
              <CardTitle>About Section</CardTitle>
              <CardDescription>
                Configure the about me section
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="about-headline">Headline</Label>
                <Input
                  id="about-headline"
                  value={settings.about.headline}
                  onChange={(e) => updateAbout("headline", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="about-description">Description</Label>
                <Textarea
                  id="about-description"
                  value={settings.about.description}
                  onChange={(e) => updateAbout("description", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-4">
                <Label>Features</Label>
                {settings.about.features.map((feature, index) => (
                  <div key={index} className="p-4 rounded-lg bg-secondary/30 space-y-3">
                    <Input
                      placeholder="Feature name"
                      value={feature.name}
                      onChange={(e) => updateAboutFeature(index, "name", e.target.value)}
                    />
                    <Textarea
                      placeholder="Feature description"
                      value={feature.description}
                      onChange={(e) => updateAboutFeature(index, "description", e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Section */}
        <TabsContent value="skills">
          <Card className="bg-card/50 border-border/60">
            <CardHeader>
              <CardTitle>Skills Section</CardTitle>
              <CardDescription>
                Configure your skill categories and items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.skills.map((category, index) => (
                <div key={index} className="p-4 rounded-lg bg-secondary/30 space-y-3">
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input
                      value={category.name}
                      onChange={(e) => updateSkillCategory(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Skills (comma-separated)</Label>
                    <Input
                      value={category.skills.join(", ")}
                      onChange={(e) =>
                        updateSkillCategory(
                          index,
                          "skills",
                          e.target.value.split(",").map((s) => s.trim())
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    skills: [...prev.skills, { name: "New Category", skills: [] }],
                  }))
                }
              >
                Add Category
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Section */}
        <TabsContent value="contact">
          <Card className="bg-card/50 border-border/60">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Configure your contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={settings.contact.email}
                  onChange={(e) => updateContact("email", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
                <Input
                  id="contact-linkedin"
                  value={settings.contact.linkedin}
                  onChange={(e) => updateContact("linkedin", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone (optional)</Label>
                <Input
                  id="contact-phone"
                  value={settings.contact.phone}
                  onChange={(e) => updateContact("phone", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
