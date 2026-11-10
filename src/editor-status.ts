import { createContext, useContext, useEffect, useId } from "react";

export const EditorStatus = createContext({
  announcement: "",
  notify: (_message: string) => {},
  activity: (_id: string, _message: string) => {},
});

export function useStatusNotice() {
  return useContext(EditorStatus).notify;
}

export function useStatusActivity(message: string) {
  const { activity } = useContext(EditorStatus);
  const id = useId();
  useEffect(() => {
    if (!message) return;
    activity(id, message);
    return () => activity(id, "");
  }, [activity, id, message]);
}

export function StatusActivity({ message }: { message: string }) {
  useStatusActivity(message);
  return null;
}
