import { Button } from "../ui/Button";
import { useSupportAppEntryUrl } from "../../hooks/useSupportAppEntryUrl";

export function GetHelpButton() {
  const supportAppUrl = useSupportAppEntryUrl();
  if (!supportAppUrl) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={() => window.location.assign(supportAppUrl)}
    >
      Get help
    </Button>
  );
}
