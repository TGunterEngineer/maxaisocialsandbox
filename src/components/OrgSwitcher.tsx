import { useState } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Building2, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrgSwitcher() {
  const { organization, organizations, switchOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newOrgName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: newOrgId, error: rpcErr } = await supabase.rpc("create_organization", {
        _name: newOrgName.trim(),
      });
      if (rpcErr) throw rpcErr;

      await queryClient.invalidateQueries({ queryKey: ["user_organizations"] });
      switchOrganization(newOrgId as string);
      setDialogOpen(false);
      setNewOrgName("");
      toast({ title: "Created", description: `Organization "${newOrgName.trim()}" created.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (!organization) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-colors text-left">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1 font-medium">{organization.name}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                if (org.id === organization.id) return;
                // Wipe all cached tenant data so the next org cannot read
                // anything that belonged to the previous org.
                queryClient.removeQueries();
                switchOrganization(org.id);
              }}
              className={org.id === organization.id ? "bg-muted font-medium" : ""}
            >
              <Building2 className="mr-2 h-4 w-4" />
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="e.g. Acme Corp"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newOrgName.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
