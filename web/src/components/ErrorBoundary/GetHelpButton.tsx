import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useSupportAppEntryUrl } from "../../hooks/useSupportAppEntryUrl";

export function GetHelpButton() {
  const navigate = useNavigate();
  const supportAppUrl = useSupportAppEntryUrl();
  if (!supportAppUrl) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={() => navigate(supportAppUrl)}
    >
      Get help
    </Button>
  );
}
