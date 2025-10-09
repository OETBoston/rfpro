import { Button, SpaceBetween } from "@cloudscape-design/components";
import styles from "../../styles/chat.module.scss";

interface PromptButtonsProps {
  onPromptClick: (prompt: string) => void;
  customPrompts?: string[];
}

export default function PromptButtons({ onPromptClick, customPrompts }: PromptButtonsProps) {
  const defaultPrompts = [
    "What procurement method is most appropriate for purchasing software?",
    "Write a scope of work for a constituent outreach consultant.",
    "How do I find a certified supplier?"
  ];
  
  console.log("PromptButtons received customPrompts:", customPrompts);
  const prompts = customPrompts || defaultPrompts;
  console.log("Using prompts:", prompts);

  return (
    <div className="prompt-buttons-container" style={{
      margin: '0 0 8px 0',
      padding: '0'
    }}>
      <SpaceBetween direction="horizontal" size="xs">
        {prompts.map((prompt, index) => (
          <div key={index} style={{ flex: 1 }}>
            <Button
              variant="normal"
              onClick={() => onPromptClick(prompt)}
              fullWidth={true}
            >
              <div style={{ 
                fontSize: '16px', 
                lineHeight: '1.1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                textAlign: 'left',
                whiteSpace: 'normal',
                padding: '2px 0'
              }}>
                {prompt}
              </div>
            </Button>
          </div>
        ))}
      </SpaceBetween>
    </div>
  );
}
