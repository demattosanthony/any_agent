"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useMeQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useAtom } from "jotai";
import { instructionsAtom, temperatureAtom } from "@/atoms/chat";
import { useEffect, useState } from "react";
import UtilityApiIntegration from "@/components/UtilityApiIntegration";

export default function UserSettings() {
  const { data: user } = useMeQuery();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [temperature, setTemperature] = useAtom(temperatureAtom);
  const [, setInputValue] = useState(temperature.toFixed(2));
  const [instructions, setInstructions] = useAtom(instructionsAtom);

  const handleTemperatureChange = (value: number[]) => {
    const newTemp = value[0];
    setTemperature(newTemp);
  };

  useEffect(() => {
    setInputValue(temperature.toFixed(1));
  }, [temperature]);

  // Add useEffect for client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-20 px-6 w-full">
      <h1 className="text-xl font-semibold mb-8">User Settings</h1>

      <div className="space-y-6">
        {/* Profile Picture Section */}
        <section>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-medium">Profile Picture</h2>
              <p className="text-sm text-muted-foreground">
                You look good today!
              </p>
            </div>
            <Avatar>
              <AvatarImage src={user?.profilePicture ?? ""} />
              <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Interface Theme Section */}
        <section>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-medium">Interface theme</h2>
              <p className="text-sm text-muted-foreground">
                Select your interface color scheme.
              </p>
            </div>
            {mounted && (
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-48">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {theme === "light" && <Sun className="w-4 h-4" />}
                      {theme === "dark" && <Moon className="w-4 h-4" />}
                      {theme === "system" && <Monitor className="w-4 h-4" />}
                      <span className="capitalize">{theme}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      <span>System</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      <span>Light</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      <span>Dark</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Model Settings Section */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-medium">Model Settings</h2>
            <p className="text-sm text-muted-foreground">
              Customize how the AI model responds to your prompts.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-normal">Creativity</h3>
                <span className="text-sm text-muted-foreground">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[temperature]}
                onValueChange={handleTemperatureChange}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-normal">Custom Instructions</h3>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Add personal details or preferences to customize Yo's responses (e.g. 'I'm a beginner programmer' or 'Explain things simply'). You can also add specific instructions like 'Always include code examples' or 'Be more detailed'"
                className="min-h-[160px] resize-none"
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Integrations Section */}
        <UtilityApiIntegration />
      </div>
    </div>
  );
}
