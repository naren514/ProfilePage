"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  Search,
  Globe,
  Linkedin,
  Github,
  Building2,
  Briefcase,
  Award,
  Wrench,
  Heart,
  Check,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface ParsedExperience {
  company: string;
  title: string;
  location?: string;
  employmentType?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  achievements?: string[];
  technologies?: string[];
  selected?: boolean;
}

interface ParsedProject {
  title: string;
  summary: string;
  description?: string;
  technologies?: string[];
  company?: string;
  role?: string;
  url?: string;
  selected?: boolean;
}

interface ParsedCertification {
  name: string;
  issuer: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  selected?: boolean;
}

interface ParsedSkill {
  name: string;
  category: string;
  proficiency?: number;
  selected?: boolean;
}

interface ParsedVolunteer {
  organization: string;
  role: string;
  location?: string;
  cause?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  selected?: boolean;
}

interface ParsedProfile {
  name?: string;
  headline?: string;
  summary?: string;
  location?: string;
  experiences: ParsedExperience[];
  projects: ParsedProject[];
  certifications: ParsedCertification[];
  skills: ParsedSkill[];
  volunteerWork: ParsedVolunteer[];
  education?: Array<{
    school: string;
    degree: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

interface ParseResult {
  success: boolean;
  profile: ParsedProfile;
  sourceUrl: string;
  sourceType: string;
  groundingSearches?: string[];
  groundingSources?: Array<{ url: string; title: string }>;
}

export default function ProfileImportPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const parseProfile = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/parse-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse profile");
      }

      const data = await response.json();

      // Add selected flag to all items
      data.profile.experiences = data.profile.experiences.map((e: ParsedExperience) => ({ ...e, selected: true }));
      data.profile.projects = data.profile.projects.map((p: ParsedProject) => ({ ...p, selected: true }));
      data.profile.certifications = data.profile.certifications.map((c: ParsedCertification) => ({ ...c, selected: true }));
      data.profile.skills = data.profile.skills.map((s: ParsedSkill) => ({ ...s, selected: true }));
      data.profile.volunteerWork = data.profile.volunteerWork.map((v: ParsedVolunteer) => ({ ...v, selected: true }));

      setResult(data);
      toast.success("Profile parsed successfully!");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse profile");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (
    section: "experiences" | "projects" | "certifications" | "skills" | "volunteerWork",
    index: number
  ) => {
    if (!result) return;

    const newResult = { ...result };
    const newProfile = { ...newResult.profile };

    switch (section) {
      case "experiences":
        newProfile.experiences = newProfile.experiences.map((item, i) =>
          i === index ? { ...item, selected: !item.selected } : item
        );
        break;
      case "projects":
        newProfile.projects = newProfile.projects.map((item, i) =>
          i === index ? { ...item, selected: !item.selected } : item
        );
        break;
      case "certifications":
        newProfile.certifications = newProfile.certifications.map((item, i) =>
          i === index ? { ...item, selected: !item.selected } : item
        );
        break;
      case "skills":
        newProfile.skills = newProfile.skills.map((item, i) =>
          i === index ? { ...item, selected: !item.selected } : item
        );
        break;
      case "volunteerWork":
        newProfile.volunteerWork = newProfile.volunteerWork.map((item, i) =>
          i === index ? { ...item, selected: !item.selected } : item
        );
        break;
    }

    newResult.profile = newProfile;
    setResult(newResult);
  };

  const saveExperiences = async () => {
    if (!result) return;

    const selectedExperiences = result.profile.experiences.filter((e) => e.selected);
    if (selectedExperiences.length === 0) {
      toast.error("No experiences selected");
      return;
    }

    setSavingSection("experiences");
    let savedCount = 0;

    try {
      for (const exp of selectedExperiences) {
        const response = await fetch("/api/admin/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: exp.company,
            title: exp.title,
            location: exp.location || "",
            employmentType: exp.employmentType || "full-time",
            startDate: exp.startDate || new Date().toISOString().split("T")[0],
            endDate: exp.endDate || "",
            isCurrent: exp.isCurrent,
            description: exp.description || "",
            achievements: exp.achievements || [],
            technologies: exp.technologies || [],
          }),
        });

        if (response.ok) {
          savedCount++;
        }
      }

      toast.success(`Saved ${savedCount} experience${savedCount !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to save some experiences");
    } finally {
      setSavingSection(null);
    }
  };

  const saveCertifications = async () => {
    if (!result) return;

    const selectedCerts = result.profile.certifications.filter((c) => c.selected);
    if (selectedCerts.length === 0) {
      toast.error("No certifications selected");
      return;
    }

    setSavingSection("certifications");
    let savedCount = 0;

    try {
      for (const cert of selectedCerts) {
        const response = await fetch("/api/admin/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cert.name,
            issuer: cert.issuer,
            issueDate: cert.issueDate || new Date().toISOString().split("T")[0],
            expirationDate: cert.expirationDate || "",
            credentialId: cert.credentialId || "",
            credentialUrl: cert.credentialUrl || "",
            isActive: true,
          }),
        });

        if (response.ok) {
          savedCount++;
        }
      }

      toast.success(`Saved ${savedCount} certification${savedCount !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to save some certifications");
    } finally {
      setSavingSection(null);
    }
  };

  const saveSkills = async () => {
    if (!result) return;

    const selectedSkills = result.profile.skills.filter((s) => s.selected);
    if (selectedSkills.length === 0) {
      toast.error("No skills selected");
      return;
    }

    setSavingSection("skills");
    let savedCount = 0;

    try {
      for (const skill of selectedSkills) {
        const response = await fetch("/api/admin/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: skill.name,
            category: skill.category,
            proficiency: skill.proficiency || 80,
          }),
        });

        if (response.ok) {
          savedCount++;
        }
      }

      toast.success(`Saved ${savedCount} skill${savedCount !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to save some skills");
    } finally {
      setSavingSection(null);
    }
  };

  const saveVolunteerWork = async () => {
    if (!result) return;

    const selectedVolunteer = result.profile.volunteerWork.filter((v) => v.selected);
    if (selectedVolunteer.length === 0) {
      toast.error("No volunteer work selected");
      return;
    }

    setSavingSection("volunteer");
    let savedCount = 0;

    try {
      for (const vol of selectedVolunteer) {
        const response = await fetch("/api/admin/volunteer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization: vol.organization,
            role: vol.role,
            location: vol.location || "",
            cause: vol.cause || "",
            description: vol.description || "",
            startDate: vol.startDate || "",
            endDate: vol.endDate || "",
            isCurrent: vol.isCurrent,
            skills: [],
            isPublished: false,
          }),
        });

        if (response.ok) {
          savedCount++;
        }
      }

      toast.success(`Saved ${savedCount} volunteer entr${savedCount !== 1 ? "ies" : "y"}`);
    } catch {
      toast.error("Failed to save some volunteer work");
    } finally {
      setSavingSection(null);
    }
  };

  const getSourceIcon = () => {
    if (url.includes("linkedin.com")) return <Linkedin className="h-4 w-4" />;
    if (url.includes("github.com")) return <Github className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Import</h1>
        <p className="text-muted-foreground">
          Import professional data from LinkedIn, GitHub, or other profile URLs using AI-powered extraction
        </p>
      </div>

      {/* URL Input Section */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Parse Profile URL
          </CardTitle>
          <CardDescription>
            Enter a LinkedIn profile URL, GitHub profile, or any professional website to extract information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {getSourceIcon()}
              </div>
              <Input
                placeholder="https://linkedin.com/in/username or https://github.com/username"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && parseProfile()}
              />
            </div>
            <Button onClick={parseProfile} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Parse Profile
                </>
              )}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              <Linkedin className="h-3 w-3 mr-1" />
              LinkedIn Profiles
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Github className="h-3 w-3 mr-1" />
              GitHub Profiles
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              Personal Websites
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-card/50 border-border/60">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Searching the web for profile information...</p>
                <p className="text-sm text-muted-foreground">
                  Using AI with Google Search grounding for live data extraction
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Profile Overview */}
          <Card className="bg-card/50 border-border/60">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{result.profile.name || "Unknown"}</CardTitle>
                  {result.profile.headline && (
                    <p className="text-muted-foreground mt-1">{result.profile.headline}</p>
                  )}
                  {result.profile.location && (
                    <p className="text-sm text-muted-foreground">{result.profile.location}</p>
                  )}
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  {result.sourceType === "linkedin" && <Linkedin className="h-3 w-3" />}
                  {result.sourceType === "github" && <Github className="h-3 w-3" />}
                  {result.sourceType === "website" && <Globe className="h-3 w-3" />}
                  {result.sourceType}
                </Badge>
              </div>
            </CardHeader>
            {result.profile.summary && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.profile.summary}</p>
              </CardContent>
            )}
          </Card>

          {/* Grounding Sources */}
          {result.groundingSources && result.groundingSources.length > 0 && (
            <Card className="bg-secondary/30 border-border/40">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Sources Used
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="flex flex-wrap gap-2">
                  {result.groundingSources.slice(0, 5).map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                    >
                      {source.title || source.url}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Data Tabs */}
          <Tabs defaultValue="experiences" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="experiences" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Experience</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {result.profile.experiences.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="certifications" className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Certs</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {result.profile.certifications.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="skills" className="flex items-center gap-1">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Skills</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {result.profile.skills.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Projects</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {result.profile.projects.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="volunteer" className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Volunteer</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {result.profile.volunteerWork.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Experiences Tab */}
            <TabsContent value="experiences" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select experiences to import
                </p>
                <Button
                  onClick={saveExperiences}
                  disabled={savingSection === "experiences"}
                >
                  {savingSection === "experiences" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Save Selected
                </Button>
              </div>

              {result.profile.experiences.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {result.profile.experiences.map((exp, index) => (
                    <AccordionItem
                      key={index}
                      value={`exp-${index}`}
                      className={`border rounded-lg px-4 ${exp.selected ? "border-primary/50 bg-primary/5" : "border-border/60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={exp.selected}
                          onCheckedChange={() => toggleItemSelection("experiences", index)}
                        />
                        <AccordionTrigger className="flex-1 hover:no-underline">
                          <div className="flex-1 text-left">
                            <p className="font-medium">{exp.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {exp.company} {exp.location && `• ${exp.location}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate || "N/A"}
                            </p>
                          </div>
                        </AccordionTrigger>
                      </div>
                      <AccordionContent className="pt-2 pb-4">
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mb-3">{exp.description}</p>
                        )}
                        {exp.achievements && exp.achievements.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium mb-1">Achievements:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {exp.achievements.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {exp.technologies && exp.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {exp.technologies.map((tech, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <Card className="bg-secondary/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No experiences found in the profile
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Certifications Tab */}
            <TabsContent value="certifications" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select certifications to import
                </p>
                <Button
                  onClick={saveCertifications}
                  disabled={savingSection === "certifications"}
                >
                  {savingSection === "certifications" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Save Selected
                </Button>
              </div>

              {result.profile.certifications.length > 0 ? (
                <div className="space-y-2">
                  {result.profile.certifications.map((cert, index) => (
                    <Card
                      key={index}
                      className={`${cert.selected ? "border-primary/50 bg-primary/5" : "border-border/60"}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <Switch
                            checked={cert.selected}
                            onCheckedChange={() => toggleItemSelection("certifications", index)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{cert.name}</p>
                            <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {cert.issueDate && <span>Issued: {cert.issueDate}</span>}
                              {cert.expirationDate && <span>• Expires: {cert.expirationDate}</span>}
                              {cert.credentialId && <span>• ID: {cert.credentialId}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-secondary/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No certifications found in the profile
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select skills to import
                </p>
                <Button
                  onClick={saveSkills}
                  disabled={savingSection === "skills"}
                >
                  {savingSection === "skills" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Save Selected
                </Button>
              </div>

              {result.profile.skills.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {result.profile.skills.map((skill, index) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-colors ${skill.selected ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-border"}`}
                      onClick={() => toggleItemSelection("skills", index)}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center gap-2">
                          {skill.selected ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-4 w-4 rounded border border-muted-foreground/50" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{skill.name}</p>
                            <p className="text-xs text-muted-foreground">{skill.category}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-secondary/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No skills found in the profile
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Projects can be reviewed and added manually via the Projects page
              </p>

              {result.profile.projects.length > 0 ? (
                <div className="space-y-2">
                  {result.profile.projects.map((project, index) => (
                    <Card key={index} className="border-border/60">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{project.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {project.summary || project.description}
                            </p>
                            {project.technologies && project.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {project.technologies.map((tech, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {tech}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          {project.url && (
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-secondary/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No projects found in the profile
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Volunteer Tab */}
            <TabsContent value="volunteer" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select volunteer work to import
                </p>
                <Button
                  onClick={saveVolunteerWork}
                  disabled={savingSection === "volunteer"}
                >
                  {savingSection === "volunteer" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Save Selected
                </Button>
              </div>

              {result.profile.volunteerWork.length > 0 ? (
                <div className="space-y-2">
                  {result.profile.volunteerWork.map((vol, index) => (
                    <Card
                      key={index}
                      className={`${vol.selected ? "border-primary/50 bg-primary/5" : "border-border/60"}`}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <Switch
                            checked={vol.selected}
                            onCheckedChange={() => toggleItemSelection("volunteerWork", index)}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{vol.role}</p>
                            <p className="text-sm text-muted-foreground">{vol.organization}</p>
                            {vol.cause && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {vol.cause}
                              </Badge>
                            )}
                            {vol.description && (
                              <p className="text-sm text-muted-foreground mt-2">{vol.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-secondary/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No volunteer work found in the profile
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
