/**
 * AIChat — editor assistant powered by Workers AI (llama-3.1-8b-instruct).
 *
 * Posts {message, history, context} to the Worker and receives {reply, actions[]}.
 * Actions are dispatched to caller-provided handlers — this module never touches
 * Three.js or the equipment state directly.
 *
 * Usage:
 *   const chat = new AIChat({
 *     endpoint: MANIFEST_API + '/api/ai/chat',
 *     getContext: () => ({ race, equipped, attrs, availableRaces, availableSlots }),
 *     handlers: { setRace, equip, unequip, setAttr, playAnim, save },
 *   });
 *   chat.mount(document.getElementById('aiChatRoot'));
 */

const MAX_HISTORY = 8;

export class AIChat {
  constructor({ endpoint, getContext, handlers }) {
    this.endpoint = endpoint;
    this.getContext = getContext || (() => ({}));
    this.handlers = handlers || {};
    this.history = [];
    this.root = null;
    this.logEl = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.pending = false;
  }

  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="ai-log" id="aiLog" style="height:240px;overflow-y:auto;border:1px solid var(--border);
        border-radius:4px;padding:8px;font-size:.75rem;background:rgba(0,0,0,.25);margin-bottom:6px;"></div>
      <div style="display:flex;gap:4px;">
        <input id="aiInput" type="text" placeholder="e.g. 'switch to orc and give me a 2H axe'"
          style="flex:1;padding:6px 8px;font-size:.8rem;background:var(--bg);color:var(--text);
          border:1px solid var(--border);border-radius:4px;">
        <button id="aiSend" class="action-btn">Send</button>
      </div>
      <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">
        <button class="ai-quick action-btn" data-q="Equip a full set of armor variant B">Armor B</button>
        <button class="ai-quick action-btn" data-q="Give me a sword and shield">Sword+Shield</button>
        <button class="ai-quick action-btn" data-q="Max out STR and VIT, lower INT">Tank build</button>
        <button class="ai-quick action-btn" data-q="Switch to elf and equip a bow">Elf archer</button>
      </div>
      <p style="font-size:.65rem;color:var(--muted);margin-top:6px;">
        Powered by Workers AI · Llama 3.1 8B. Actions apply directly to the viewer.
      </p>
    `;
    this.logEl = root.querySelector('#aiLog');
    this.inputEl = root.querySelector('#aiInput');
    this.sendBtn = root.querySelector('#aiSend');

    this.sendBtn.addEventListener('click', () => this._submit());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submit(); }
    });
    root.querySelectorAll('.ai-quick').forEach((b) =>
      b.addEventListener('click', () => { this.inputEl.value = b.dataset.q; this._submit(); }),
    );

    this._append('assistant', "Hi — tell me what to change. Try \"switch to dwarf\" or \"give me a 2H hammer\".");
  }

  async _submit() {
    if (this.pending) return;
    const msg = (this.inputEl.value || '').trim();
    if (!msg) return;
    this.inputEl.value = '';
    this._append('user', msg);
    this.pending = true;
    this.sendBtn.disabled = true;

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: this.history, context: this.getContext() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.reply || '(no reply)';
      const actions = Array.isArray(data.actions) ? data.actions : [];
      this._append('assistant', reply);
      this.history.push({ role: 'user', content: msg });
      this.history.push({ role: 'assistant', content: reply });
      if (this.history.length > MAX_HISTORY * 2) this.history = this.history.slice(-MAX_HISTORY * 2);
      await this._applyActions(actions);
    } catch (err) {
      this._append('assistant', `⚠ ${err.message || 'request failed'}`);
    } finally {
      this.pending = false;
      this.sendBtn.disabled = false;
    }
  }

  async _applyActions(actions) {
    for (const a of actions) {
      if (!a || typeof a !== 'object') continue;
      const h = this.handlers;
      try {
        switch (a.type) {
          case 'setRace':  await h.setRace?.(a.factionId, a.raceId); break;
          case 'equip':    await h.equip?.(a.slot, a.variant); break;
          case 'unequip':  await h.unequip?.(a.slot); break;
          case 'setAttr':  h.setAttr?.(a.key, a.value); break;
          case 'playAnim': await h.playAnim?.(a.pack, a.file); break;
          case 'save':     await h.save?.(a.name); break;
          default: this._append('assistant', `(skipped unknown action: ${a.type})`);
        }
      } catch (err) {
        this._append('assistant', `⚠ action ${a.type} failed: ${err.message}`);
      }
    }
  }

  _append(role, text) {
    if (!this.logEl) return;
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:6px;line-height:1.35;';
    const label = role === 'user' ? '<b style="color:var(--accent);">you</b>' : '<b style="color:#a78bfa;">grudge</b>';
    div.innerHTML = `${label} ${this._escape(text)}`;
    this.logEl.appendChild(div);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _escape(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  }
}
