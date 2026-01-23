import type { Service } from '../service.js';

export const Contact =
  ({ el, signal, match }: Service) =>
  () => {
    // Simple form state - demonstrates that interactivity still works
    const name = signal('');
    const email = signal('');
    const message = signal('');
    const submitted = signal(false);

    const handleSubmit = (e: Event) => {
      e.preventDefault();
      // In a real app, you'd send this to a server
      console.log('Form submitted:', {
        name: name(),
        email: email(),
        message: message(),
      });
      submitted(true);
    };

    return el('div').props({ className: 'page contact-page' })(
      el('h2')('Contact Us'),
      el('p').props({ className: 'lead' })(
        "We'd love to hear from you. Send us a message and we'll respond as soon as possible."
      ),

      el('div').props({ className: 'contact-grid' })(
        el('section').props({ className: 'contact-info' })(
          el('h3')('Get in Touch'),
          el('p')(el('strong')('Email: '), 'hello@example.com'),
          el('p')(el('strong')('Location: '), 'San Francisco, CA'),
          el('p')(el('strong')('Hours: '), 'Mon-Fri, 9am-5pm PT')
        ),

        el('form').props({
          className: 'contact-form',
          onsubmit: handleSubmit,
        })(
          match(submitted, (isSubmitted) =>
            isSubmitted
              ? el('div').props({ className: 'success-message' })(
                  el('h3')('Thanks for reaching out!'),
                  el('p')("We'll be in touch soon.")
                )
              : el('div').props({ className: 'form-fields' })(
                  el('div').props({ className: 'form-group' })(
                    el('label').props({ for: 'name' })('Name'),
                    el('input').props({
                      type: 'text',
                      id: 'name',
                      name: 'name',
                      required: true,
                      oninput: (e: Event) =>
                        name((e.target as HTMLInputElement).value),
                    })()
                  ),

                  el('div').props({ className: 'form-group' })(
                    el('label').props({ for: 'email' })('Email'),
                    el('input').props({
                      type: 'email',
                      id: 'email',
                      name: 'email',
                      required: true,
                      oninput: (e: Event) =>
                        email((e.target as HTMLInputElement).value),
                    })()
                  ),

                  el('div').props({ className: 'form-group' })(
                    el('label').props({ for: 'message' })('Message'),
                    el('textarea').props({
                      id: 'message',
                      name: 'message',
                      rows: 5,
                      required: true,
                      oninput: (e: Event) =>
                        message((e.target as HTMLTextAreaElement).value),
                    })()
                  ),

                  el('button').props({
                    type: 'submit',
                    className: 'primary-btn',
                  })('Send Message')
                )
          )
        )
      )
    );
  };
