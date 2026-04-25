import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Onboarding() {
  const { setProfile, setCurrentView } = useStore();
  const [name, setName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ((window as any).electronAPI && (file as any).path) {
      setIsParsing(true);
      try {
        const text = await (window as any).electronAPI.file.parsePdf((file as any).path);
        setResumeText(text);
      } catch (err) {
        console.error("Failed to parse PDF", err);
        alert("Failed to read PDF file.");
      }
      setIsParsing(false);
    } else {
      alert("Please run in the desktop app to parse PDFs.");
    }
  };

  const handleSave = () => {
    if (!name || !resumeText) return;

    const newProfile = {
      id: Date.now().toString(),
      user_id: 'user_1',
      resume_text: resumeText,
      parsed_resume: JSON.stringify({ name }),
      default_style: 'Concise'
    };

    setProfile(newProfile);
    
    if ((window as any).electronAPI) {
       (window as any).electronAPI.db.saveProfile(newProfile);
    }
    
    setCurrentView('home');
  };

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to Mocking Bird AI</CardTitle>
          <p className="text-sm text-muted-foreground">Let's set up your profile to ground our AI.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload your Resume (PDF)</label>
            <Input type="file" accept=".pdf" onChange={handleFileUpload} disabled={isParsing} />
            {isParsing && <p className="text-xs text-primary animate-pulse">Extracting text...</p>}
            {!isParsing && resumeText && <p className="text-xs text-green-600">✓ Resume parsed successfully ({resumeText.length} characters)</p>}
          </div>
          <Button className="w-full" onClick={handleSave} disabled={isParsing || !resumeText}>Save Profile & Continue</Button>
        </CardContent>
      </Card>
    </div>
  );
}
