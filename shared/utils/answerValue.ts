import { Answer, Question } from "../generated/prisma/browser";

/**
 * Human-readable value of `answer` for `question` - used for table cells and CSV exports on
 * both frontend and backend, so every export renders answers the same way.
 */
export function getAnswerValue(
  answer: Answer | undefined,
  question: Question,
): string | number | null {
  if (!answer) return "---";

  switch (question.type) {
    case "Integer":
      return answer.answerInt;
    case "Float":
      return answer.answerNum;
    case "Text":
    case "Textarea":
      return answer.answerText;
    case "Date":
      return answer.answerDate
        ? new Date(answer.answerDate).toLocaleDateString("de-DE", {
            timeZone: "Europe/Berlin",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "";
    case "Select":
      return answer.answerSelectId
        .map((id) => {
          const option = question.selectOptions.find((so) => so.id === id);

          if (!option) {
            console.error(`option ${id} not found, was it deleted?`);
            return "Fehler: Antwort-Option nicht gefunden";
          }

          if (!option.isOpen) return option.text;
          else return answer.answerText || "";
        })
        .join();
    default:
      return null;
  }
}
