'use strict';
// Web account deletion: email a code, then confirm with it.
(function () {
  const form = document.getElementById('del');
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const msg = (text, bad) => { $('msg').textContent = text; $('msg').style.color = bad ? '#B42318' : ''; };
  const lang = form.dataset.lang;

  async function post(path, body) {
    const res = await fetch(`/api/v1/auth/delete/${path}?lang=${lang}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail = data.error?.details?.fieldErrors;
      throw new Error((detail && Object.values(detail).flat()[0]) || data.error?.message || form.dataset.failed);
    }
  }

  $('send').addEventListener('click', async () => {
    const email = $('email').value.trim();
    if (!$('email').checkValidity() || !email) { $('email').reportValidity(); return; }
    $('send').disabled = true;
    try {
      await post('request', { email });
      $('step2').hidden = false;
      $('code').focus();
      msg(form.dataset.sent);
    } catch (err) { msg(err.message, true); }
    setTimeout(() => { $('send').disabled = false; }, 60000);
  });

  $('confirm').addEventListener('click', async () => {
    $('confirm').disabled = true;
    try {
      await post('confirm', { email: $('email').value.trim(), code: $('code').value.trim() });
      $('step2').hidden = true;
      $('send').hidden = true;
      $('email').disabled = true;
      msg(form.dataset.done);
    } catch (err) {
      msg(err.message, true);
      $('confirm').disabled = false;
    }
  });
}());
