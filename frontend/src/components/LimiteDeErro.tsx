import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Por padrão recarrega a página; os testes passam a sua própria função. */
  onRecarregar?: () => void;
}

interface Estado {
  quebrou: boolean;
}

/** Se a tela quebrar, mostra o que fazer em vez de uma página em branco. */
export class LimiteDeErro extends Component<Props, Estado> {
  state: Estado = { quebrou: false };

  static getDerivedStateFromError(): Estado {
    return { quebrou: true };
  }

  render() {
    if (!this.state.quebrou) return this.props.children;
    const recarregar = this.props.onRecarregar ?? (() => window.location.reload());
    return (
      <div role="alert" className="mx-auto mt-16 max-w-xl rounded-md border-2 border-forte bg-superficie p-6">
        <p className="text-lg font-semibold text-forte">Algo deu errado na tela.</p>
        <p className="mt-2 text-sm">
          Nenhum dado saiu deste computador. Recarregue a página para continuar. Se você salvou o trabalho, use
          &ldquo;Abrir trabalho&rdquo; para voltar de onde parou.
        </p>
        <button type="button" className="botao-primario mt-4" onClick={recarregar}>
          Recarregar a página
        </button>
      </div>
    );
  }
}
