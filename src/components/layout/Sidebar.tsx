import { NavList } from "@primer/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PeopleIcon,
  DatabaseIcon,
  GitCompareIcon,
  DownloadIcon,
  InfoIcon,
} from "@primer/octicons-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof PeopleIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/clients", label: "Clients", icon: PeopleIcon },
  { to: "/supports", label: "Supports", icon: DatabaseIcon },
  { to: "/arbitrage", label: "Arbitrage", icon: GitCompareIcon },
  { to: "/import", label: "Import", icon: DownloadIcon },
  { to: "/about", label: "About", icon: InfoIcon },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <NavList>
      {NAV_ITEMS.map((item) => {
        const active = location.pathname.startsWith(item.to);
        return (
          <NavList.Item
            key={item.to}
            href={item.to}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.to);
            }}
          >
            <NavList.LeadingVisual>
              <item.icon />
            </NavList.LeadingVisual>
            {item.label}
          </NavList.Item>
        );
      })}
    </NavList>
  );
}
