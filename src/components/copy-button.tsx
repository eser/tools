import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { CopyIcon, CheckIcon } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton(props: CopyButtonProps) {
  const { text, className } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5 mr-1" />
          Copied!
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}
