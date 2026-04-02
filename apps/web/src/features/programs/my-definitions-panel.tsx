import { useEffect } from 'react';
import { isRecord } from '@gzclp/shared/type-guards';
import { useDefinitions } from '@/hooks/use-definitions';
import { Button } from '@/components/button';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Borrador',
  pending_review: 'En revision',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const STATUS_COLORS: Readonly<Record<string, string>> = {
  draft: 'bg-zinc-700 text-zinc-300',
  pending_review: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

interface MyDefinitionsPanelProps {
  readonly onOpenWizard: (definitionId: string) => void;
  readonly onStartProgram: (definitionId: string) => void;
}

export function MyDefinitionsPanel({
  onOpenWizard,
  onStartProgram,
}: MyDefinitionsPanelProps): React.ReactNode {
  const {
    definitions,
    isLoading,
    deleteDefinition,
    isDeleting,
    deleteError,
    deleteErrorDefId,
    clearDeleteError,
  } = useDefinitions();

  // Clear delete error on unmount
  useEffect(() => clearDeleteError, [clearDeleteError]);

  const handleDelete = (id: string, name: string): void => {
    if (!window.confirm(`¿Eliminar "${name}"? Esta accion no se puede deshacer.`)) return;
    deleteDefinition(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="bg-card border border-rule p-5 animate-pulse">
            <div className="h-4 w-40 bg-rule rounded mb-2" />
            <div className="h-3 w-24 bg-rule rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (definitions.length === 0) {
    return (
      <div className="bg-card border border-rule p-6 text-center">
        <p className="text-sm text-muted">
          No tienes programas personalizados. Personaliza uno desde el catalogo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {definitions.map((def) => {
        const statusLabel = STATUS_LABELS[def.status] ?? def.status;
        const statusColor = STATUS_COLORS[def.status] ?? STATUS_COLORS.draft;

        // Extract name from the definition JSONB using type guard
        let name = 'Programa sin nombre';
        if (isRecord(def.definition) && typeof def.definition.name === 'string') {
          name = def.definition.name;
        }

        const hasDeleteError = deleteErrorDefId === def.id && deleteError !== null;

        return (
          <div key={def.id} className="bg-card border border-rule p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-title truncate">{name}</h4>
                  <span
                    className={`shrink-0 text-2xs font-bold px-2 py-0.5 rounded ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="text-2xs text-muted">
                  Actualizado: {new Date(def.updatedAt).toLocaleDateString('es-ES')}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => onOpenWizard(def.id)}>
                  Editar
                </Button>
                {def.status === 'draft' && (
                  <Button size="sm" variant="primary" onClick={() => onStartProgram(def.id)}>
                    Empezar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(def.id, name)}
                  disabled={isDeleting}
                >
                  Eliminar
                </Button>
              </div>
            </div>

            {hasDeleteError && (
              <p className="text-xs text-red-400" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
