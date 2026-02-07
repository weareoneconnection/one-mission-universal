"use client";

export type UiMsg = { role: "user" | "assistant"; text: string };

export default function AiMessageList({ messages }: { messages: UiMsg[] }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <div
          key={i}
          className={[
            "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
            m.role === "user" ? "bg-black text-white ml-10" : "bg-black/5 mr-10"
          ].join(" ")}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
