import { createFileRoute, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useViewer } from "@/app/viewer";

/** facebook.com/me/<tab> (photos, about, friends...) opens that tab of the viewer's own profile. */
export const Route = createFileRoute("/me_/$")({
  component: function MeTabRedirect() {
    const { username } = useViewer();
    const { _splat = "" } = Route.useParams();
    const { searchStr, hash } = useLocation();
    const { history } = useRouter();
    useEffect(() => {
      const tab = _splat ? `/${_splat}` : "";
      history.replace(`/${username}${tab}${searchStr}${hash ? `#${hash}` : ""}`);
    }, [history, username, _splat, searchStr, hash]);
    return null;
  },
});
