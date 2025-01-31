"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { handleGoogleLogin, handleSSOLogin } = useAuth();

  const [ssoSelected, setSsoSelected] = React.useState(false);
  const [workEmail, setWorkEmail] = React.useState("");

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 h-full">
      <div className="absolute top-1 left-1">
        <Button
          onClick={() => {
            if (ssoSelected) {
              setSsoSelected(false);
            } else {
              router.back();
            }
          }}
          size={"icon"}
          variant={"ghost"}
        >
          <ArrowLeft size={24} />
        </Button>
      </div>

      <main className="flex flex-col gap-8 items-center w-full justify-center h-[75%]">
        <Image src="/yo-blob.png" alt="logo" height={75} width={75} />

        {/** Title and description */}
        <div className="flex flex-col items-center w-[400px] gap-2 mt-4">
          <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Yo! Let's get started
          </h3>
          {/* <p className="text-base text-muted-foreground text-center">
            What's up?
          </p> */}
        </div>

        {/** Oauth buttons */}
        {!ssoSelected && (
          <div className="flex flex-col gap-4">
            <Button
              className="font-semibold w-[320px] flex justify-start h-[50px]"
              onClick={handleGoogleLogin}
              variant={"outline"}
            >
              <img src="/google.svg" alt="google" className="h-5 w-5 mr-1" />
              Continue with Google
            </Button>
            <Button
              className="font-semibold w-[320px] flex justify-start h-[50px]"
              onClick={() => setSsoSelected(true)}
              variant={"outline"}
            >
              <Key className="mr-1 h-5 w-5" />
              Single sign-on (SSO)
            </Button>
          </div>
        )}

        {ssoSelected && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              // Basic email validation regex
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(workEmail)) {
                alert("Please enter a valid email address");
                return;
              }
              handleSSOLogin(workEmail.split("@")[1].split(".")[0]);
            }}
          >
            <Input
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              placeholder="Enter your work email"
              className="w-[320px] h-[50px]"
              autoFocus
              required
            />

            <Button
              type="submit"
              className="font-semibold w-[320px] flex justify-center h-[50px]"
              disabled={!workEmail}
            >
              Continue with SAML SSO
              <ArrowRight size={24} className="ml-1" />
            </Button>
          </form>
        )}
      </main>

      <div className="absolute bottom-2">
        <Link href={"https://syyclops.com"} target="_blank">
          <Button variant={"link"}>By Syyclops</Button>
        </Link>
      </div>
    </div>
  );
}
