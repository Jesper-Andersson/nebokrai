// The settings page (Options.svelte), opened in a tab of its own.
import { mount } from 'svelte';
import Options from './Options.svelte';

mount(Options, { target: document.getElementById('app')! });
