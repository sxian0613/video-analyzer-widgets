/* eslint-disable @typescript-eslint/no-unused-expressions */
import { FASTSlider } from '@microsoft/fast-components';
import { attr, customElement, FASTElement } from '@microsoft/fast-element';
import { SegmentsTimelineComponent } from '..';
import { closestElement } from '../../../common/utils/elements';
import { guid } from '../../../common/utils/guid';
import { ISegmentsTimelineConfig, IUISegmentEventData, SegmentsTimelineEvents } from '../segments-timeline/segments-timeline.definitions';
import { TimeRulerComponent } from '../time-ruler';
import { ITimeLineConfig, TimelineEvents } from './timeline.definitions';
import { styles } from './timeline.style';
import { template } from './timeline.template';

SegmentsTimelineComponent;
TimeRulerComponent;

/**
 * Time Line component.
 * @public
 */
@customElement({
    name: 'media-timeline',
    template,
    styles
})
export class TimelineComponent extends FASTElement {
    @attr public id: string = guid();

    /**
     * The config of the time line.
     *
     * @public
     * @remarks
     * HTML attribute: config
     */
    @attr public config: ITimeLineConfig;

    /**
     * current time, indicate the current line time
     *
     * @public
     * @remarks
     * HTML attribute: current time
     */
    @attr public currentTime: number = 0;

    public readonly DAY_DURATION_IN_SECONDS = 86400; // 60 (sec) * 60 (min) * 24 (hours)

    public zoom: number = 1;

    private timeRulerReady = false;
    private segmentsTimelineReady = false;
    private segmentsTimeline: SegmentsTimelineComponent;
    private timeRuler: TimeRulerComponent;
    private fastSlider: FASTSlider;

    private resizeObserver: ResizeObserver;

    private readonly SLIDER_DENSITY = 32;
    private readonly SLIDER_MAX_ZOOM = 22;
    private readonly SEEK_BAR_TOP = '#FAF9F8';
    private readonly SEEK_BAR_BODY_COLOR = '#D02E00';

    public configChanged() {
        setTimeout(() => {
            this.initData();
            this.initTimeLine();
        });
    }

    public currentTimeChanged() {
        if (this.segmentsTimeline) {
            this.segmentsTimeline.currentTime = this.currentTime;
        }
    }

    public connectedCallback() {
        super.connectedCallback();
        this.initData();

        const parent = this.$fastController?.element?.parentElement;
        this.resizeObserver = new ResizeObserver(this.resize.bind(this));
        this.resizeObserver.observe(parent || this.$fastController?.element);
    }

    public disconnectedCallback() {
        super.disconnectedCallback();

        this.resizeObserver?.disconnect();
        this.fastSlider?.removeEventListener('change', this.fastSliderChange);
        this.segmentsTimeline?.removeEventListener(SegmentsTimelineEvents.SEGMENT_CLICKED, null);
    }

    public initData() {
        if (!this.config) {
            return;
        }

        // Disabling zoom on FireFox since we can't modify the scrollbar on FireFox
        if (navigator.userAgent.includes('Firefox')) {
            this.config.enableZoom = false;
        }

        if (this.config.enableZoom && !this.fastSlider) {
            /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
            this.fastSlider = document.createElement('fast-slider') as any;
            this.$fastController.element.shadowRoot.appendChild(this.fastSlider);
            this.fastSlider?.addEventListener('change', this.fastSliderChange.bind(this));
        } else if (!this.fastSlider) {
            this.$fastController.element.style.overflowX = 'hidden';
        }
    }

    public getNextSegmentTime(): number {
        return this.segmentsTimeline?.getNextSegment();
    }

    public getPreviousSegmentTime(): number {
        return this.segmentsTimeline?.getPreviousSegment();
    }

    public segmentsTimelineConnectedCallback() {
        setTimeout(() => {
            this.segmentsTimeline = <SegmentsTimelineComponent>this.shadowRoot?.querySelector('media-segments-timeline');

            this.segmentsTimeline?.addEventListener(SegmentsTimelineEvents.SEGMENT_CLICKED, ((event: CustomEvent<IUISegmentEventData>) => {
                this.$emit(TimelineEvents.SEGMENT_CHANGE, event.detail);
                // eslint-disable-next-line no-undef
            }) as EventListener);

            this.segmentsTimeline?.addEventListener(SegmentsTimelineEvents.SEGMENT_START, ((event: CustomEvent<IUISegmentEventData>) => {
                this.$emit(TimelineEvents.SEGMENT_START, event.detail);
                // eslint-disable-next-line no-undef
            }) as EventListener);

            this.segmentsTimelineReady = true;
            this.initTimeLine();
        });
    }

    public timeRulerConnectedCallback() {
        setTimeout(() => {
            this.timeRuler = <TimeRulerComponent>this.shadowRoot?.querySelector('media-time-ruler');
            this.timeRulerReady = true;
            this.initTimeLine();
        });
    }

    private initTimeLine() {
        if (!this.timeRulerReady || !this.segmentsTimelineReady) {
            return;
        }

        this.initSegmentsTimeline();
        this.initTimeRuler();
        setTimeout(() => {
            this.initSlider();
        }, 50);
    }

    private initSlider() {
        if (!this.config?.enableZoom || !this.fastSlider) {
            return;
        }

        const boundingClientRect = this.$fastController.element.getBoundingClientRect();
        this.fastSlider.style.top = `${boundingClientRect.top + boundingClientRect.height - 20}px`;
        this.fastSlider.style.left = `${boundingClientRect.left + boundingClientRect.width - 93}px`;
        this.fastSlider.min = this.SLIDER_DENSITY;
        this.fastSlider.max = this.SLIDER_MAX_ZOOM * this.SLIDER_DENSITY;
        this.fastSlider.value = `${this.zoom * this.SLIDER_DENSITY}`;
    }

    private initSegmentsTimeline() {
        const designSystem = closestElement('ava-design-system-provider', this.$fastController.element);
        const seekBarTopColor = designSystem ? getComputedStyle(designSystem)?.getPropertyValue('--type-highlight') : this.SEEK_BAR_TOP;
        const seekBarBodyColor = designSystem
            ? getComputedStyle(designSystem)?.getPropertyValue('--play-indicator')
            : this.SEEK_BAR_BODY_COLOR;
        const config: ISegmentsTimelineConfig = {
            data: {
                segments: this.config?.segments,
                duration: this.DAY_DURATION_IN_SECONDS
            },
            displayOptions: {
                height: 30,
                barHeight: 12,
                top: 5,
                renderTooltip: false,
                renderProgress: false,
                renderSeek: {
                    seekBarTopColor: seekBarTopColor,
                    seekBarBodyColor: seekBarBodyColor
                },
                zoom: this.zoom,
                disableCursor: true
            }
        };

        this.segmentsTimeline.config = config;
    }

    private initTimeRuler() {
        this.timeRuler.startDate = this.config?.date || new Date();
        this.timeRuler.zoom = this.zoom;
    }

    private resize() {
        this.initTimeLine();
    }

    private fastSliderChange() {
        this.zoom = +this.fastSlider.value / this.SLIDER_DENSITY;
        this.initSegmentsTimeline();
        this.initTimeRuler();
    }
}
