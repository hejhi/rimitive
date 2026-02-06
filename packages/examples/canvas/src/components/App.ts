/**
 * App Component
 *
 * Follows the idiomatic Rimitive behavior pattern:
 *   (svc) => () => RefSpec
 *
 * Service layer called once, card behaviors bound once.
 */
import type { ShareCardData, shareCard } from './ShareCard';
import type { CanvasBridgeElement } from '../canvas-adapter';
import type { DOM, Canvas } from '../service';
import type {
  SignalFactory,
  ComputedFactory,
  EffectFactory,
} from '@rimitive/signals';

const CARD_WIDTH = 400;
const CARD_HEIGHT = 200;

// The bound shareCard behavior - what you get after svc(shareCard)
type BoundShareCard = ReturnType<typeof shareCard>;

type AppDeps = {
  dom: DOM;
  canvas: Canvas;
  signals: {
    signal: SignalFactory;
    computed: ComputedFactory;
    effect: EffectFactory;
  };
  cards: {
    dom: BoundShareCard;
    canvas: BoundShareCard;
  };
};

/**
 * App behavior - demonstrates portable components rendering to DOM and Canvas.
 */
export const App = ({ dom, canvas, signals, cards }: AppDeps) => {
  const { signal, computed, effect } = signals;
  const { div, h1, p, span, a, label, input, button, code, strong, br } = dom;
  const { dom: DOMShareCard, canvas: CanvasShareCard } = cards;
  const { canvas: CanvasComponent } = canvas;

  const formGroup: typeof div = div.props({ className: 'form-group' });

  return () => {
    // Shared reactive state
    const name = signal('Ada Lovelace');
    const handle = signal('ada');
    const avatar = signal(
      'https://api.dicebear.com/7.x/avataaars/svg?seed=ada'
    );
    const followers = signal(12400);
    const posts = signal(847);

    let canvasEl: CanvasBridgeElement | null = null;

    const cardData: ShareCardData = {
      name,
      handle,
      avatar,
      followers,
      posts,
    };

    effect(() => {
      avatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${handle()}`);
    });

    const downloadPng = () => {
      if (!canvasEl) return;
      try {
        const link = document.createElement('a');
        link.download = `${handle()}-card.png`;
        link.href = canvasEl.toDataURL('image/png');
        link.click();
      } catch {
        alert('Cannot download: canvas contains cross-origin image.');
      }
    };

    return div.props({ className: 'app' })(
      div.props({ className: 'header' })(
        h1('One Component, Two Renderers'),
        p.props({ className: 'subtitle' })(
          'Same portable shareCard behavior renders to DOM and Canvas.'
        )
      ),

      div.props({ className: 'renders' })(
        div.props({ className: 'render-section' })(
          div.props({ className: 'render-label' })('DOM'),
          div.props({ className: 'render-container dom-container' })(
            DOMShareCard({
              data: cardData,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
            })
          )
        ),

        div.props({ className: 'render-section' })(
          div.props({ className: 'render-label' })('Canvas'),
          div.props({ className: 'render-container' })(
            CanvasComponent.props({
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              clearColor: '#0f0f23',
            }).ref((el) => {
              canvasEl = el;
            })(
              CanvasShareCard({
                data: cardData,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
              })
            )
          ),
          button.props({
            className: 'download-btn',
            onclick: downloadPng,
          })('Download PNG')
        )
      ),

      div.props({ className: 'form-section' })(
        p.props({ className: 'form-intro' })(
          'Edit below — both renders update from the same signals:'
        ),
        div.props({ className: 'form-grid' })(
          formGroup(
            label('Name'),
            input.props({
              type: 'text',
              value: name,
              oninput: (e: Event) => name((e.target as HTMLInputElement).value),
            })()
          ),
          formGroup(
            label('Handle'),
            div.props({ className: 'input-with-prefix' })(
              span.props({ className: 'prefix' })('@'),
              input.props({
                type: 'text',
                value: handle,
                oninput: (e: Event) =>
                  handle((e.target as HTMLInputElement).value),
              })()
            )
          ),
          formGroup(
            label('Followers'),
            input.props({
              type: 'number',
              value: computed(() => String(followers())),
              oninput: (e: Event) =>
                followers(parseInt((e.target as HTMLInputElement).value) || 0),
            })()
          ),
          formGroup(
            label('Posts'),
            input.props({
              type: 'number',
              value: computed(() => String(posts())),
              oninput: (e: Event) =>
                posts(parseInt((e.target as HTMLInputElement).value) || 0),
            })()
          )
        )
      ),

      div.props({ className: 'info' })(
        p(
          code('const DOMShareCard = domCardSvc(shareCard)'),
          br(),
          code('const CanvasShareCard = canvasCardSvc(shareCard)')
        ),
        p(
          strong('Same portable behavior, different services.'),
          ' The shareCard behavior is injected with domCardSvc or canvasCardSvc, each providing different cardElements implementations.'
        ),
        p(
          "The component doesn't import DOM or Canvas specifics. It just asks the service for ",
          code('cardElements'),
          ' and uses them.'
        ),
        p(
          a.props({
            href: 'https://github.com/hejhi/rimitive/tree/main/packages/examples/canvas',
            target: '_blank',
          })('View source on GitHub')
        )
      )
    );
  };
};
