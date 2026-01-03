/**
 * HTML Rendering Verification Tests
 *
 * Tests that verify React Email components are properly
 * converted to valid HTML with correct structure and attributes.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from '@react-email/components';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineMail } from '../mail.js';
import { createMailManager } from '../manager.js';

describe('HTML Rendering Verification', () => {
  describe('basic HTML structure', () => {
    it('should render a complete HTML document with doctype', async () => {
      const BasicEmail = defineMail({
        name: 'basic-html',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(Head),
            React.createElement(Body, null, React.createElement(Text, null, 'Hello'))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(BasicEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('<!DOCTYPE html');
      expect(rendered.html).toContain('<html');
      expect(rendered.html).toContain('<head');
      expect(rendered.html).toContain('<body');
      expect(rendered.html).toContain('Hello');
      await manager.close();
    });

    it('should render Heading component as h1 tag', async () => {
      const HeadingEmail = defineMail({
        name: 'heading-test',
        schema: z.object({ title: z.string() }),
        subject: 'Test',
        template: ({ title }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Body, null, React.createElement(Heading, { as: 'h1' }, title))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(HeadingEmail, {
        to: 'user@example.com',
        data: { title: 'Welcome Message' },
      });

      expect(rendered.html).toContain('<h1');
      expect(rendered.html).toContain('Welcome Message');
      expect(rendered.html).toContain('</h1>');
      await manager.close();
    });

    it('should render Text component as paragraph', async () => {
      const TextEmail = defineMail({
        name: 'text-test',
        schema: z.object({ message: z.string() }),
        subject: 'Test',
        template: ({ message }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Body, null, React.createElement(Text, null, message))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(TextEmail, {
        to: 'user@example.com',
        data: { message: 'This is a paragraph.' },
      });

      expect(rendered.html).toContain('<p');
      expect(rendered.html).toContain('This is a paragraph.');
      expect(rendered.html).toContain('</p>');
      await manager.close();
    });
  });

  describe('interactive elements', () => {
    it('should render Button with href attribute', async () => {
      const ButtonEmail = defineMail({
        name: 'button-test',
        schema: z.object({ buttonUrl: z.string(), buttonText: z.string() }),
        subject: 'Test',
        template: ({ buttonUrl, buttonText }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Button, { href: buttonUrl }, buttonText)
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(ButtonEmail, {
        to: 'user@example.com',
        data: { buttonUrl: 'https://example.com/activate', buttonText: 'Click Here' },
      });

      expect(rendered.html).toContain('href="https://example.com/activate"');
      expect(rendered.html).toContain('Click Here');
      await manager.close();
    });

    it('should render Link component with href', async () => {
      const LinkEmail = defineMail({
        name: 'link-test',
        schema: z.object({ linkUrl: z.string(), linkText: z.string() }),
        subject: 'Test',
        template: ({ linkUrl, linkText }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Body, null, React.createElement(Link, { href: linkUrl }, linkText))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(LinkEmail, {
        to: 'user@example.com',
        data: { linkUrl: 'https://example.com/help', linkText: 'Get Help' },
      });

      expect(rendered.html).toContain('<a');
      expect(rendered.html).toContain('href="https://example.com/help"');
      expect(rendered.html).toContain('Get Help');
      expect(rendered.html).toContain('</a>');
      await manager.close();
    });
  });

  describe('layout components', () => {
    it('should render Container component', async () => {
      const ContainerEmail = defineMail({
        name: 'container-test',
        schema: z.object({ content: z.string() }),
        subject: 'Test',
        template: ({ content }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Container, null, React.createElement(Text, null, content))
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(ContainerEmail, {
        to: 'user@example.com',
        data: { content: 'Container content here' },
      });

      // Container typically renders as a table for email compatibility
      expect(rendered.html).toContain('Container content here');
      await manager.close();
    });

    it('should render Section component', async () => {
      const SectionEmail = defineMail({
        name: 'section-test',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(
                Section,
                null,
                React.createElement(Text, null, 'Section 1'),
                React.createElement(Text, null, 'Section 2')
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SectionEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('Section 1');
      expect(rendered.html).toContain('Section 2');
      await manager.close();
    });

    it('should render Hr (horizontal rule)', async () => {
      const HrEmail = defineMail({
        name: 'hr-test',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Text, null, 'Before'),
              React.createElement(Hr),
              React.createElement(Text, null, 'After')
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(HrEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('<hr');
      expect(rendered.html).toContain('Before');
      expect(rendered.html).toContain('After');
      await manager.close();
    });
  });

  describe('inline styles', () => {
    it('should render inline styles on components', async () => {
      const StyledEmail = defineMail({
        name: 'styled-test',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(
                Text,
                { style: { color: '#ff0000', fontSize: '18px' } },
                'Red text'
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(StyledEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('color');
      expect(rendered.html).toContain('Red text');
      await manager.close();
    });

    it('should render Button with style props', async () => {
      const StyledButtonEmail = defineMail({
        name: 'styled-button',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(
                Button,
                {
                  href: 'https://example.com',
                  style: { backgroundColor: '#007bff', color: 'white', padding: '12px 24px' },
                },
                'Styled Button'
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(StyledButtonEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('Styled Button');
      expect(rendered.html).toContain('https://example.com');
      await manager.close();
    });
  });

  describe('dynamic content rendering', () => {
    it('should render dynamic list items', async () => {
      const ListEmail = defineMail({
        name: 'list-test',
        schema: z.object({
          items: z.array(z.object({ name: z.string(), price: z.number() })),
        }),
        subject: 'Your Order',
        template: ({ items }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Heading, { as: 'h2' }, 'Order Items'),
              ...items.map((item, index) =>
                React.createElement(Text, { key: index }, `${item.name}: $${item.price.toFixed(2)}`)
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(ListEmail, {
        to: 'user@example.com',
        data: {
          items: [
            { name: 'Widget', price: 9.99 },
            { name: 'Gadget', price: 24.5 },
            { name: 'Gizmo', price: 15.0 },
          ],
        },
      });

      expect(rendered.html).toContain('Order Items');
      expect(rendered.html).toContain('Widget: $9.99');
      expect(rendered.html).toContain('Gadget: $24.50');
      expect(rendered.html).toContain('Gizmo: $15.00');
      await manager.close();
    });

    it('should render conditional content', async () => {
      const ConditionalEmail = defineMail({
        name: 'conditional-test',
        schema: z.object({
          isPremium: z.boolean(),
          userName: z.string(),
        }),
        subject: 'Welcome',
        template: ({ isPremium, userName }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Heading, { as: 'h1' }, `Hello ${userName}`),
              isPremium
                ? React.createElement(Text, null, 'Thank you for being a premium member!')
                : React.createElement(Text, null, 'Upgrade to premium for exclusive benefits.')
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      // Test premium user
      const premiumRendered = await manager.render(ConditionalEmail, {
        to: 'user@example.com',
        data: { isPremium: true, userName: 'Alice' },
      });

      expect(premiumRendered.html).toContain('Hello Alice');
      expect(premiumRendered.html).toContain('Thank you for being a premium member!');
      expect(premiumRendered.html).not.toContain('Upgrade to premium');

      // Test regular user
      const regularRendered = await manager.render(ConditionalEmail, {
        to: 'user@example.com',
        data: { isPremium: false, userName: 'Bob' },
      });

      expect(regularRendered.html).toContain('Hello Bob');
      expect(regularRendered.html).toContain('Upgrade to premium for exclusive benefits.');
      expect(regularRendered.html).not.toContain('premium member');

      await manager.close();
    });

    it('should render nested dynamic content', async () => {
      const NestedEmail = defineMail({
        name: 'nested-test',
        schema: z.object({
          categories: z.array(
            z.object({
              name: z.string(),
              products: z.array(z.string()),
            })
          ),
        }),
        subject: 'Product Catalog',
        template: ({ categories }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              ...categories.map((cat, catIdx) =>
                React.createElement(
                  Section,
                  { key: catIdx },
                  React.createElement(Heading, { as: 'h2' }, cat.name),
                  ...cat.products.map((product, prodIdx) =>
                    React.createElement(Text, { key: prodIdx }, `- ${product}`)
                  )
                )
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(NestedEmail, {
        to: 'user@example.com',
        data: {
          categories: [
            { name: 'Electronics', products: ['Phone', 'Laptop'] },
            { name: 'Books', products: ['Fiction', 'Non-fiction', 'Sci-fi'] },
          ],
        },
      });

      expect(rendered.html).toContain('Electronics');
      expect(rendered.html).toContain('- Phone');
      expect(rendered.html).toContain('- Laptop');
      expect(rendered.html).toContain('Books');
      expect(rendered.html).toContain('- Fiction');
      expect(rendered.html).toContain('- Non-fiction');
      expect(rendered.html).toContain('- Sci-fi');
      await manager.close();
    });
  });

  describe('plain text generation from HTML', () => {
    it('should auto-generate plain text from HTML', async () => {
      const AutoTextEmail = defineMail({
        name: 'auto-text',
        schema: z.object({ name: z.string() }),
        subject: 'Test',
        template: ({ name }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Heading, { as: 'h1' }, `Hello ${name}`),
              React.createElement(Text, null, 'Welcome to our service!'),
              React.createElement(Button, { href: 'https://example.com' }, 'Get Started')
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(AutoTextEmail, {
        to: 'user@example.com',
        data: { name: 'John' },
      });

      // Auto-generated plain text should contain the text content
      expect(rendered.text).toContain('Hello John');
      expect(rendered.text).toContain('Welcome to our service');
      expect(rendered.text).toContain('Get Started');
      await manager.close();
    });

    it('should prefer custom text over auto-generated', async () => {
      const CustomTextEmail = defineMail({
        name: 'custom-text',
        schema: z.object({ name: z.string() }),
        subject: 'Test',
        template: ({ name }) =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Heading, { as: 'h1' }, `Hello ${name}`),
              React.createElement(Text, null, 'HTML content here')
            )
          ),
        text: ({ name }) => `Plain text version for ${name}. Much simpler!`,
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(CustomTextEmail, {
        to: 'user@example.com',
        data: { name: 'Jane' },
      });

      expect(rendered.text).toBe('Plain text version for Jane. Much simpler!');
      expect(rendered.text).not.toContain('HTML content');
      await manager.close();
    });
  });

  describe('special characters and encoding', () => {
    it('should properly encode special HTML characters in content', async () => {
      const SpecialCharsEmail = defineMail({
        name: 'special-chars',
        schema: z.object({ code: z.string() }),
        subject: 'Code Sample',
        template: ({ code }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Body, null, React.createElement(Text, null, `Code: ${code}`))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(SpecialCharsEmail, {
        to: 'user@example.com',
        data: { code: '<script>alert("XSS")</script>' },
      });

      // React should escape HTML entities
      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;');
      await manager.close();
    });

    it('should handle unicode characters', async () => {
      const UnicodeEmail = defineMail({
        name: 'unicode-test',
        schema: z.object({ message: z.string() }),
        subject: 'Test',
        template: ({ message }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Body, null, React.createElement(Text, null, message))
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(UnicodeEmail, {
        to: 'user@example.com',
        data: { message: '你好世界 🌍 مرحبا العالم' },
      });

      expect(rendered.html).toContain('你好世界');
      expect(rendered.html).toContain('🌍');
      expect(rendered.html).toContain('مرحبا العالم');
      await manager.close();
    });

    it('should handle ampersands and quotes', async () => {
      const AmpersandEmail = defineMail({
        name: 'ampersand-test',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(
              Body,
              null,
              React.createElement(Text, null, 'Terms & Conditions'),
              React.createElement(Text, null, 'He said "Hello"')
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(AmpersandEmail, {
        to: 'user@example.com',
        data: {},
      });

      expect(rendered.html).toContain('Terms');
      expect(rendered.html).toContain('Conditions');
      expect(rendered.html).toContain('Hello');
      await manager.close();
    });
  });

  describe('complete email template', () => {
    it('should render a realistic welcome email', async () => {
      const WelcomeEmail = defineMail({
        name: 'welcome-email',
        schema: z.object({
          userName: z.string(),
          activationUrl: z.string(),
          supportEmail: z.string(),
        }),
        subject: ({ userName }) => `Welcome to our app, ${userName}!`,
        template: ({ userName, activationUrl, supportEmail }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Head),
            React.createElement(
              Body,
              { style: { fontFamily: 'Arial, sans-serif' } },
              React.createElement(
                Container,
                null,
                React.createElement(Heading, { as: 'h1' }, `Welcome, ${userName}!`),
                React.createElement(
                  Text,
                  null,
                  'Thank you for signing up. Please click the button below to activate your account.'
                ),
                React.createElement(
                  Button,
                  { href: activationUrl, style: { backgroundColor: '#007bff', color: 'white' } },
                  'Activate Account'
                ),
                React.createElement(Hr),
                React.createElement(
                  Text,
                  { style: { fontSize: '12px', color: '#666' } },
                  `If you have any questions, contact us at ${supportEmail}`
                )
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'no-reply@example.com', name: 'Example App' },
      });

      const rendered = await manager.render(WelcomeEmail, {
        to: { email: 'newuser@example.com', name: 'New User' },
        data: {
          userName: 'New User',
          activationUrl: 'https://example.com/activate?token=abc123',
          supportEmail: 'support@example.com',
        },
      });

      // Verify structure
      expect(rendered.html).toContain('<!DOCTYPE html');
      expect(rendered.html).toContain('<html');

      // Verify content
      expect(rendered.html).toContain('Welcome, New User!');
      expect(rendered.html).toContain('Thank you for signing up');
      expect(rendered.html).toContain('Activate Account');
      expect(rendered.html).toContain('https://example.com/activate?token=abc123');
      expect(rendered.html).toContain('support@example.com');

      // Verify subject
      expect(rendered.subject).toBe('Welcome to our app, New User!');

      // Verify plain text version exists
      expect(rendered.text).toContain('Welcome');
      expect(rendered.text).toContain('New User');

      await manager.close();
    });

    it('should render an order confirmation email', async () => {
      const OrderEmail = defineMail({
        name: 'order-confirmation',
        schema: z.object({
          orderNumber: z.string(),
          customerName: z.string(),
          items: z.array(
            z.object({
              name: z.string(),
              quantity: z.number(),
              price: z.number(),
            })
          ),
          total: z.number(),
          trackingUrl: z.string().optional(),
        }),
        subject: ({ orderNumber }) => `Order #${orderNumber} Confirmed`,
        template: ({ orderNumber, customerName, items, total, trackingUrl }) =>
          React.createElement(
            Html,
            null,
            React.createElement(Head),
            React.createElement(
              Body,
              null,
              React.createElement(
                Container,
                null,
                React.createElement(Heading, { as: 'h1' }, 'Order Confirmation'),
                React.createElement(Text, null, `Dear ${customerName},`),
                React.createElement(Text, null, `Your order #${orderNumber} has been confirmed.`),
                React.createElement(Hr),
                React.createElement(Heading, { as: 'h2' }, 'Order Details'),
                ...items.map((item, idx) =>
                  React.createElement(
                    Text,
                    { key: idx },
                    `${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
                  )
                ),
                React.createElement(Hr),
                React.createElement(
                  Text,
                  { style: { fontWeight: 'bold' } },
                  `Total: $${total.toFixed(2)}`
                ),
                trackingUrl
                  ? React.createElement(Button, { href: trackingUrl }, 'Track Your Order')
                  : null
              )
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'orders@example.com' },
      });

      const rendered = await manager.render(OrderEmail, {
        to: 'customer@example.com',
        data: {
          orderNumber: 'ORD-2024-001',
          customerName: 'John Doe',
          items: [
            { name: 'Widget Pro', quantity: 2, price: 29.99 },
            { name: 'Gadget Mini', quantity: 1, price: 49.99 },
          ],
          total: 109.97,
          trackingUrl: 'https://example.com/track/ORD-2024-001',
        },
      });

      expect(rendered.subject).toBe('Order #ORD-2024-001 Confirmed');
      expect(rendered.html).toContain('Order Confirmation');
      expect(rendered.html).toContain('John Doe');
      expect(rendered.html).toContain('ORD-2024-001');
      expect(rendered.html).toContain('Widget Pro');
      expect(rendered.html).toContain('$59.98'); // 2 x 29.99
      expect(rendered.html).toContain('Gadget Mini');
      expect(rendered.html).toContain('$49.99');
      expect(rendered.html).toContain('$109.97');
      expect(rendered.html).toContain('Track Your Order');
      expect(rendered.html).toContain('https://example.com/track/ORD-2024-001');

      await manager.close();
    });
  });

  describe('HTML validity', () => {
    it('should produce properly closed tags', async () => {
      const CloseTagsEmail = defineMail({
        name: 'close-tags',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(
            Html,
            null,
            React.createElement(Head),
            React.createElement(
              Body,
              null,
              React.createElement(Container, null, React.createElement(Text, null, 'Content'))
            )
          ),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(CloseTagsEmail, {
        to: 'user@example.com',
        data: {},
      });

      // Check for proper closing tags
      expect(rendered.html).toContain('</html>');
      expect(rendered.html).toContain('</body>');
      expect(rendered.html).toContain('</p>');

      await manager.close();
    });

    it('should include proper meta tags for email rendering', async () => {
      const MetaTagsEmail = defineMail({
        name: 'meta-tags',
        schema: z.object({}),
        subject: 'Test',
        template: () =>
          React.createElement(Html, null, React.createElement(Head), React.createElement(Body)),
      });

      const manager = await createMailManager({
        driver: 'log',
        from: { email: 'test@example.com' },
      });

      const rendered = await manager.render(MetaTagsEmail, {
        to: 'user@example.com',
        data: {},
      });

      // Check for viewport meta or charset
      expect(rendered.html.toLowerCase()).toMatch(/<head[^>]*>/);
      await manager.close();
    });
  });
});
