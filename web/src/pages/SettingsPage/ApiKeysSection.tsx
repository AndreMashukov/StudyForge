import React, { useMemo, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/Dialog';
import { Badge } from '../../components/ui/Badge';
import { BulkSelectCheckbox } from '../../components/BulkSelectCheckbox';
import { BulkSelectionToolbar } from '../../components/BulkSelectionToolbar';
import { BulkActionConfirmDialog } from '../../components/BulkActionConfirmDialog';
import { BulkActionResultDialog } from '../../components/BulkActionResultDialog';
import {
  useListApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useBulkRevokeApiKeysMutation,
} from '../../store/api/ApiKeys/apiKeysApi';
import { IApiKey } from '../../store/api/ApiKeys/IApiKeysApi';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/dateUtils';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { useBulkActionFlow } from '../../hooks/useBulkActionFlow';

export const ApiKeysSection: React.FC = () => {
  const { data, isLoading, error } = useListApiKeysQuery();
  const [createApiKey, { isLoading: isCreating }] = useCreateApiKeyMutation();
  const [revokeApiKey, { isLoading: isRevoking }] = useRevokeApiKeyMutation();
  const [bulkRevokeApiKeys, { isLoading: isBulkRevoking }] =
    useBulkRevokeApiKeysMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<IApiKey | null>(null);

  const activeKeys = useMemo(
    () => data?.keys?.filter((k) => k.active) ?? [],
    [data?.keys],
  );
  const visibleIds = useMemo(
    () => activeKeys.map((key) => key.keyId),
    [activeKeys],
  );
  const selection = useBulkSelection({ visibleIds });
  const bulkFlow = useBulkActionFlow();

  const labelsById = useMemo(
    () => Object.fromEntries(activeKeys.map((key) => [key.keyId, key.name])),
    [activeKeys],
  );

  const handleOpenCreate = () => {
    setKeyName('');
    setNewKey(null);
    setCopied(false);
    setShowCreateDialog(true);
  };

  const handleCloseCreate = () => {
    setShowCreateDialog(false);
    setNewKey(null);
    setKeyName('');
    setCopied(false);
  };

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    try {
      const result = await createApiKey({ name: keyName.trim() }).unwrap();
      setNewKey(result.key);
    } catch {
      // error handled by RTK Query
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenRevoke = (key: IApiKey) => {
    setRevokeTarget(key);
    setShowRevokeDialog(true);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeApiKey({ keyId: revokeTarget.keyId }).unwrap();
      setShowRevokeDialog(false);
      setRevokeTarget(null);
    } catch {
      // keep dialog open so user can retry
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-0">
          {selection.selectedCount > 0 ? (
            <BulkSelectionToolbar
              selectedCount={selection.selectedCount}
              allVisibleSelected={selection.allVisibleSelected}
              onSelectAllVisible={selection.selectAllVisible}
              onClear={selection.clear}
              actionLabel={`Revoke selected (${selection.selectedCount})`}
              onAction={bulkFlow.openConfirm}
              actionIcon={null}
            />
          ) : (
            <div className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Use API keys to access Code Insights AI from external applications.
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-1" />
                New Key
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {!!error && (
            <p className="text-destructive text-sm py-4">Failed to load API keys.</p>
          )}

          {!isLoading && !error && activeKeys.length === 0 && (
            <p className="text-muted-foreground text-sm py-4">
              No API keys yet. Create one to get started.
            </p>
          )}

          {!isLoading && !error && activeKeys.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-2 w-10 font-medium text-muted-foreground">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Key</th>
                      <th className="pb-2 font-medium text-muted-foreground">Created</th>
                      <th className="pb-2 font-medium text-muted-foreground">Last used</th>
                      <th className="pb-2 font-medium text-muted-foreground" />
                    </tr>
                  </thead>
                  <tbody>
                    {activeKeys.map((key) => (
                      <tr
                        key={key.keyId}
                        className={cn(
                          'border-b border-border/50 last:border-0',
                          selection.isSelected(key.keyId) && 'bg-muted/30',
                        )}
                      >
                        <td className="py-3 pr-2 align-middle">
                          <BulkSelectCheckbox
                            checked={selection.isSelected(key.keyId)}
                            onCheckedChange={(checked) => {
                              if (checked !== selection.isSelected(key.keyId)) {
                                selection.toggle(key.keyId);
                              }
                            }}
                            label={`Select API key ${key.name}`}
                          />
                        </td>
                        <td className="py-3 pr-4 font-medium text-foreground">{key.name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {key.keyPrefix.replace(/\.\.\.$/, '')}...
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {key.createdAt ? formatDate(key.createdAt) : '—'}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revoke ${key.name}`}
                            onClick={() => handleOpenRevoke(key)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open && !newKey) handleCloseCreate(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your key a descriptive name so you can identify it later.
            </DialogDescription>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/40 bg-primary/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-primary">
                  Copy this key now — it will not be shown again.
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-1 block">API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={newKey}
                    className="font-mono text-xs"
                    aria-label="Generated API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    aria-label="Copy API key"
                    className={cn(copied && 'border-accent text-accent')}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseCreate}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. openclaw-production"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreate}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!keyName.trim() || isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={(open) => { if (!open) { setShowRevokeDialog(false); setRevokeTarget(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke{' '}
              <span className="font-medium text-foreground">{revokeTarget?.name}</span>? Any
              applications using this key will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRevokeDialog(false); setRevokeTarget(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking}>
              {isRevoking ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkActionConfirmDialog
        open={bulkFlow.confirmOpen}
        onOpenChange={(open) => !open && bulkFlow.closeConfirm()}
        title={`Revoke ${selection.selectedCount} API key${selection.selectedCount === 1 ? '' : 's'}?`}
        description={
          <p>
            Selected keys will stop working immediately. Applications using them will
            lose access.
          </p>
        }
        confirmLabel={`Revoke ${selection.selectedCount} key${selection.selectedCount === 1 ? '' : 's'}`}
        mode="simple"
        isLoading={isBulkRevoking}
        error={bulkFlow.error}
        onConfirm={async () => {
          await bulkFlow.runBulkAction(
            () =>
              bulkRevokeApiKeys({
                keyIds: selection.selectedIds,
              }).unwrap(),
            selection,
          );
        }}
      />

      <BulkActionResultDialog
        open={bulkFlow.resultOpen}
        onOpenChange={(open) => !open && bulkFlow.closeResult()}
        title="API key revoke results"
        succeeded={bulkFlow.result?.succeeded ?? 0}
        failed={bulkFlow.result?.failed ?? 0}
        results={bulkFlow.result?.results ?? []}
        labelsById={labelsById}
      />
    </>
  );
};
